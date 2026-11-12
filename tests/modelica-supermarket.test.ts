import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { runModelicaScenario } from '../src/modelica/node.ts'
import { supermarketModelicaScenario, toSupermarketReplay } from '../src/modelica/supermarket.ts'
import { parseModelicaScenario } from '../src/modelica/runtime.ts'

const directory = fileURLToPath(new URL('..', import.meta.url))

test('Rumoca detour reaches destination with shelf contact under bounded penetration', async () => {
  const model = await runModelicaScenario(supermarketModelicaScenario('detour'), directory)
  const run = toSupermarketReplay(model)
  assert.equal(run.engine.name, 'rumoca-wasm')
  assert.equal(run.result.passed, true)
  assert.ok(run.result.goalDistanceMetres < 0.55)
  // The compliant circle/box model is a geometric prototype, NOT clearance-safe.
  assert.ok(run.result.maximumPenetrationMetres > 0)
  assert.ok(run.result.maximumPenetrationMetres < 0.20)
  assert.ok(run.observations.some(s => s.z > 1.8))
  assert.ok(run.observations.some(s => s.contactMode === 0))
})


test('Rumoca shelf probe detects the southern stocked shelf, not the center blocker', async () => {
  const scenario = parseModelicaScenario({
    ...supermarketModelicaScenario('blocked'),
    model: 'RealityLoopContacts.SupermarketShelfProbe',
    durationSeconds: 0.6,
    intervalSeconds: 0.02,
  })
  const run = await runModelicaScenario(scenario, directory)
  assert.ok(run.observations.some(s => s.channels['contactForce[4]'] > 100))
  assert.ok(run.observations.every(s => s.channels['contactForce[1]'] === 0))
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
