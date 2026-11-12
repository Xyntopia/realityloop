import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { runModelicaScenario } from '../src/modelica/node.ts'
import { supermarketModelicaScenario, toSupermarketReplay } from '../src/modelica/supermarket.ts'
import { parseModelicaScenario } from '../src/modelica/runtime.ts'

const directory = fileURLToPath(new URL('..', import.meta.url))

test('Rumoca-only detour navigates past obstruction with no contact', async () => {
  const model = await runModelicaScenario(supermarketModelicaScenario('detour'), directory)
  const run = toSupermarketReplay(model)
  assert.equal(run.engine.name, 'rumoca-wasm')
  assert.equal(run.result.passed, true)
  assert.ok(run.result.goalDistanceMetres < 0.55)
  assert.ok(run.result.maximumPenetrationMetres < 1e-3)
  assert.ok(run.observations.some(s => s.z > 1.8))
  assert.ok(run.observations.some(s => s.contactMode === 0))
})

test('Rumoca-only blocked route encounters obstacle, cannot reach goal', async () => {
  const model = await runModelicaScenario(supermarketModelicaScenario('blocked'), directory)
  const run = toSupermarketReplay(model)
  assert.equal(run.result.passed, false)
  assert.ok(run.result.maximumContactForceNewtons > 100)
  assert.ok(run.result.maximumPenetrationMetres > 0)
  assert.ok(run.result.maximumPenetrationMetres < 0.2)
  assert.ok(Math.max(...run.observations.map(s => s.x)) < 4.0)
})

test('Rumoca-only scenario output replays identically in one process', async () => {
  const scenario = supermarketModelicaScenario('blocked', 0.4)
  const a = toSupermarketReplay(await runModelicaScenario(scenario, directory))
  const b = toSupermarketReplay(await runModelicaScenario(scenario, directory))
  assert.deepEqual(a, b)
  assert.ok(a.observations.every(s => [s.x, s.z, s.yaw, s.speed].every(Number.isFinite)))
})

test('Modelica supermarket rejects nonpositive torque limit', () => {
  const base = supermarketModelicaScenario('detour')
  assert.throws(() => parseModelicaScenario({ ...base, motorTorqueNewtonMetres: 0 }))
  assert.throws(() => parseModelicaScenario({ ...base, motorTorqueNewtonMetres: -20 }))
})
