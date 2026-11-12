import { strict as assert } from 'node:assert'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { parseModelicaScenario } from '../src/modelica/runtime.ts'
import { runModelicaScenario } from '../src/modelica/node.ts'

const fixture = new URL('../scenarios/modelica-tennant-traction.json', import.meta.url)
const projectDirectory = fileURLToPath(new URL('..', import.meta.url))
const scenarioFromFile = async () => parseModelicaScenario(
  JSON.parse(await readFile(fixture, 'utf8')),
)

test('Rumoca compiles and executes Tennant front-drive Modelica equations to horizon', async () => {
  const base = await scenarioFromFile()
  const result = await runModelicaScenario({ ...base, durationSeconds: 1, intervalSeconds: 0.05 }, projectDirectory)
  assert.equal(result.engine.name, 'rumoca-wasm')
  assert.equal(result.result.passed, true)
  assert.equal(result.result.finalTimeSeconds, 1)
  assert.equal(result.result.points, 21)
  assert.ok(result.channelNames.includes('wheelSlip'))
  assert.ok(result.channelNames.includes('omegaDrive'))
  assert.ok(result.observations.every(sample => Number.isFinite(sample.channels.driveForce)))
  assert.ok(result.observations.at(-1)!.channels.x > 0.01)
})

test('Rumoca parameter overrides materially change wet-floor traction', async () => {
  const base = { ...(await scenarioFromFile()), durationSeconds: 1, intervalSeconds: 0.05 }
  const dry = await runModelicaScenario(base, projectDirectory)
  const wet = await runModelicaScenario({ ...base, frictionCoefficient: 0.12 }, projectDirectory)
  assert.ok(dry.observations.at(-1)!.channels.v > wet.observations.at(-1)!.channels.v)
  assert.ok(dry.observations.at(-1)!.channels.x > wet.observations.at(-1)!.channels.x)
})

test('Rumoca simulates independent generic differential-drive Modelica wheel model', async () => {
  const base = await scenarioFromFile()
  const result = await runModelicaScenario({
    ...base, model: 'DifferentialDriveSlip', motorTorqueNewtonMetres: 4,
    durationSeconds: 0.6, intervalSeconds: 0.05,
  }, projectDirectory)
  assert.ok(result.channelNames.includes('slipL'))
  assert.ok(result.channelNames.includes('omegaR'))
  assert.ok(result.observations.at(-1)!.channels.v > 0)
})

test('Modelica experiment has identical same-process repeated results', async () => {
  const base = { ...(await scenarioFromFile()), durationSeconds: 0.6, intervalSeconds: 0.05 }
  const first = await runModelicaScenario(base, projectDirectory)
  const second = await runModelicaScenario(base, projectDirectory)
  assert.deepEqual(second, first)
})

test('Modelica experiment rejects untrusted options and excessive sample count', () => {
  const base = {
    name: 'x', kind: 'modelica', model: 'TennantFrontSteerSlip',
    durationSeconds: 1, intervalSeconds: 0.05, frictionCoefficient: 0.6,
    motorTorqueNewtonMetres: 100,
  }
  assert.throws(() => parseModelicaScenario({ ...base, arbitraryFile: '/etc/passwd' }))
  assert.throws(() => parseModelicaScenario({ ...base, durationSeconds: 20, intervalSeconds: 0.005 }))
})
