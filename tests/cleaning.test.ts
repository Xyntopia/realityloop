import { strict as assert } from 'node:assert'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { parseCleaningScenario, runCleaningScenario } from '../src/cleaning.ts'

const load = async (route: 'blocked' | 'detour') =>
  parseCleaningScenario(JSON.parse(await readFile(
    new URL('../scenarios/cleaning-' + route + '.json', import.meta.url), 'utf8',
  )))

test('cleaning robot blocked route fails and produces a finite collision-limited trace', async () => {
  const result = await runCleaningScenario(await load('blocked'))
  assert.equal(result.result.passed, false)
  assert.ok(result.observations.length > 10)
  assert.ok(result.observations.every(o =>
    [o.x, o.z, o.yaw, o.slipLeft, o.slipRight].every(Number.isFinite)))
  assert.ok(result.observations.at(-1)!.x < 4.0)
})

test('detour route avoids shelf and reaches the target', async () => {
  const scenario = await load('detour')
  const result = await runCleaningScenario(scenario)
  assert.equal(result.result.passed, true)
  assert.ok(result.result.cleanedAreaSqMetres > 1)
  assert.ok(result.observations.at(-1)!.x > 6.9)
})

test('cleaning experiment has exact in-process replay and rejects unknown fields', async () => {
  const scenario = await load('detour')
  assert.deepEqual(await runCleaningScenario(scenario), await runCleaningScenario(scenario))
  assert.throws(() => parseCleaningScenario({ ...scenario, unsafeProperty: true }))
})
