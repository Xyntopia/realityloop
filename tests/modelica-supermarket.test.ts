import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { runModelicaScenario } from '../src/modelica/node.ts'
import { supermarketModelicaScenario, toSupermarketReplay } from '../src/modelica/supermarket.ts'
import { parseModelicaScenario } from '../src/modelica/runtime.ts'
import { supermarketObstacles } from '../src/geometry.ts'

const directory = fileURLToPath(new URL('..', import.meta.url))

test('Rumoca smooth detour reaches goal with full Tennant-footprint shelf clearance', async () => {
  const model = await runModelicaScenario(supermarketModelicaScenario('detour'), directory)
  const run = toSupermarketReplay(model)
  assert.equal(run.engine.name, 'rumoca-wasm')
  assert.equal(run.result.passed, true)
  assert.ok(run.result.goalDistanceMetres < 0.55)
  assert.equal(run.result.failureReason, null)
  assert.ok(run.result.minimumSweptClearanceMetres > 0.10)
  assert.ok(run.result.maximumPenetrationMetres <= 1e-8)
  assert.ok(run.result.arrivalTimeSeconds! < 20)
  assert.ok(run.observations.some(s => s.z > 1.8))
  assert.ok(run.observations.some(s => s.contactMode === 0))
})

test('arrival alone does not bypass a collision introduced by a scene revision', async () => {
  const model = await runModelicaScenario(supermarketModelicaScenario('detour'), directory)
  const unsafeScene = [...supermarketObstacles, {
    id: 'new-aisle-shelf', x: 3.4, z: 1.95,
    halfX: 0.35, halfZ: 0.35, height: 2.0, kind: 'shelf' as const,
  }]
  const report = toSupermarketReplay(model, unsafeScene)
  assert.equal(report.result.goalReached, true)
  assert.equal(report.result.passed, false)
  assert.equal(report.result.failureReason, 'unsafeClearance')
  assert.ok(report.result.minimumSweptClearanceMetres < 0)
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
  assert.equal(run.result.failureReason, 'goalNotReached')
  assert.ok(run.result.minimumSweptClearanceMetres < 0)
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
