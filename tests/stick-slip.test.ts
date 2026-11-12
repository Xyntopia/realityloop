import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { parseModelicaScenario } from '../src/modelica/runtime.ts'
import { runModelicaScenario } from '../src/modelica/node.ts'
import { fileURLToPath } from 'node:url'

const directory = fileURLToPath(new URL('..', import.meta.url))
const bench = (torque: number) => parseModelicaScenario({
  name: 'stick-slip-physical-modes',
  kind: 'modelica',
  model: 'RealityLoopContacts.WheelBench',
  durationSeconds: 4,
  intervalSeconds: 0.02,
  frictionCoefficient: 0.72,
  motorTorqueNewtonMetres: torque,
})

test('reusable Modelica contact sticks exactly below the static friction threshold', async () => {
  const result = await runModelicaScenario(bench(20), directory)
  assert.equal(result.result.finalTimeSeconds, 4)
  assert.ok(result.observations.every(s => s.channels.contactMode === 0))
  assert.ok(Math.max(...result.observations.map(s => Math.abs(s.channels.slipSpeed))) < 1e-8)
  assert.ok(result.observations.every(s =>
    Math.abs(s.channels.traction) <= 0.72 * 400 + 1e-5))
})

test('forward sliding loses grip and returns to sticking after wheel torque is removed', async () => {
  const result = await runModelicaScenario(bench(120), directory)
  const modes = result.observations.map(s => s.channels.contactMode)
  assert.ok(modes.includes(1))
  assert.equal(modes[0], 1)
  assert.equal(modes.at(-1), 0)
  assert.ok(Math.max(...result.observations.map(s => s.channels.slipSpeed)) > 1)
  assert.equal(result.observations.at(-1)!.channels.appliedTorque, 0)
  const slide = result.observations.find(s => s.channels.contactMode === 1)!
  assert.ok(Math.abs(slide.channels.traction - 0.75 * 0.72 * 400) < 1e-6)
})

test('reverse wheel slip supports negative kinetic friction and later resticking', async () => {
  const result = await runModelicaScenario(bench(-120), directory)
  const modes = result.observations.map(s => s.channels.contactMode)
  assert.ok(modes.includes(-1))
  assert.equal(modes.at(-1), 0)
  assert.ok(Math.min(...result.observations.map(s => s.channels.slipSpeed)) < -1)
  const slide = result.observations.find(s => s.channels.contactMode === -1)!
  assert.ok(slide.channels.traction < 0)
})

test('Tennant front-steer plant shares Modelica contact and transitions from sliding to sticking', async () => {
  const result = await runModelicaScenario(parseModelicaScenario({
    name: 'tennant-slip',
    kind: 'modelica',
    model: 'RealityLoopContacts.TennantStickSlip',
    durationSeconds: 3,
    intervalSeconds: 0.02,
    frictionCoefficient: 0.72,
    motorTorqueNewtonMetres: 400,
  }), directory)
  const modes = result.observations.map(s => s.channels.contactMode)
  assert.ok(modes.includes(1))
  assert.equal(modes.at(-1), 0)
  assert.ok(result.observations.some(s => s.channels.steer > 0.15))
  assert.ok(result.observations.at(-1)!.channels.x > 0)
})
