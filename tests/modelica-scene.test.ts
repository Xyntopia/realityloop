import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { supermarketObstacles } from '../src/geometry.ts'
import { withModelicaScene } from '../src/modelica/scene.ts'
import { runModelicaScenario } from '../src/modelica/node.ts'
import {
  supermarketModelicaScenario, toSupermarketReplay,
} from '../src/modelica/supermarket.ts'

const directory = fileURLToPath(new URL('..', import.meta.url))
const sourceFile = fileURLToPath(new URL('../modelica/RealityLoopContacts.mo', import.meta.url))

test('single scene geometry is injected deterministically into Modelica arrays', async () => {
  const source = await readFile(sourceFile, 'utf8')
  const generated = withModelicaScene(source)
  assert.equal(generated, source, 'Standalone Modelica fixture must match the canonical JS scene')
  const alternative = [
    {...supermarketObstacles[0], x: 2.8},
    {...supermarketObstacles[4], z: 4.5},
  ]
  const next = withModelicaScene(source, alternative)
  assert.match(next, /parameter Integer nObstacles=2;/)
  assert.match(next, /parameter Real obstacleX\[nObstacles\]=\{2\.8,5\.2\};/)
  assert.match(next, /parameter Real obstacleZ\[nObstacles\]=\{0,4\.5\};/)
  assert.throws(() => withModelicaScene(source, []))
  assert.throws(() => withModelicaScene(source, [alternative[0],alternative[0]]))
  assert.throws(() => withModelicaScene(source,[{...alternative[0],halfX:-1}]))
  assert.throws(() => withModelicaScene('model Fake end Fake;',alternative))
})

test('changing scene geometry changes the actual Rumoca contact trajectory', async () => {
  const scenario = supermarketModelicaScenario('blocked')
  const reference = toSupermarketReplay(await runModelicaScenario(scenario, directory))
  const alternative = [{...supermarketObstacles[0],x:2.8}]
  const changed = toSupermarketReplay(
    await runModelicaScenario(scenario, directory, alternative), alternative)
  assert.ok(Math.max(...changed.observations.map(s=>s.x)) <
    Math.max(...reference.observations.map(s=>s.x))-0.6)
  assert.equal(changed.result.passed,false)
  assert.equal(changed.result.nearestObstacleId,'blocked-aisle')
})
