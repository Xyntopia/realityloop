import { strict as assert } from 'node:assert'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { parseTennantScenario, runTennantScenario, t7amr } from '../src/tennant.ts'

const load=async(route:'blocked'|'detour')=>parseTennantScenario(JSON.parse(await readFile(
  new URL('../scenarios/tennant-'+route+'.json',import.meta.url),'utf8')))

test('T7AMR reference dimensions and narrow-aisle collision fixture',()=>{
  assert.equal(t7amr.lengthMetres,1.651)
  assert.equal(t7amr.widthMetres,0.889)
  assert.equal(t7amr.cleaningWidthMetres,0.65)
})

test('front-steered Tennant concept blocked fixture cannot reach destination',async()=>{
  const result=await runTennantScenario(await load('blocked'))
  assert.equal(result.result.passed,false)
  assert.ok(result.observations.every(s=>Number.isFinite(s.driveWheelSlip)))
})

test('front-steered Tennant concept detours to destination',async()=>{
  const result=await runTennantScenario(await load('detour'))
  assert.equal(result.result.passed,true)
  assert.ok(result.result.cleanedAreaSqMetres>0.5)
})

test('Tennant front-steer detour replays exactly in one process',async()=>{
  const scenario=await load('detour')
  const first=await runTennantScenario(scenario)
  const second=await runTennantScenario(scenario)
  assert.deepEqual(second,first)
  assert.ok(first.observations.some(s=>Math.abs(s.steerAngle)>0.15))
  assert.ok(first.observations.every(s=>Number.isFinite(s.lateralSlip)))
})
