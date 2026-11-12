import { strict as assert } from 'node:assert'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { parseScenario } from '../src/scenario.ts'
import { runScenario } from '../src/sim.ts'

const fixture = new URL('../scenarios/supermarket-blocked-aisle.json', import.meta.url)

test('blocked supermarket aisle fails the progress gate and replays identically in this process', async () => {
  const scenario = parseScenario(JSON.parse(await readFile(fixture, 'utf8')))
  const a = await runScenario(scenario)
  const b = await runScenario(scenario)
  assert.equal(a.result.passed, false)
  assert.deepEqual(a, b)
})

test('unsupported scenario fields fail closed', () => {
  assert.throws(() => parseScenario({ extra: 'untrusted' }))
})
