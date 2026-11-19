import {strict as assert} from 'node:assert'
import {test} from 'node:test'
import {fileURLToPath} from 'node:url'
import {runModelicaScenario} from '../src/modelica/node.ts'
import {parseModelicaScenario} from '../src/modelica/runtime.ts'
import {supermarketModelicaScenario,toSupermarketReplay}
  from '../src/modelica/supermarket.ts'

const directory=fileURLToPath(new URL('..',import.meta.url))
test('Rumoca supports replaceable/redeclare contact functions in Modelica',async()=>{
  const base={
    name:'provider-probe',kind:'modelica' as const,durationSeconds:1,
    intervalSeconds:.1,frictionCoefficient:.72,motorTorqueNewtonMetres:0,
  }
  const a=await runModelicaScenario(parseModelicaScenario({
    ...base,model:'RealityLoopProviders.DefaultProbe',
  }),directory)
  const b=await runModelicaScenario(parseModelicaScenario({
    ...base,model:'RealityLoopProviders.AlternateProbe',
  }),directory)
  assert.equal(a.observations[0].channels.depth,.2)
  assert.equal(b.observations[0].channels.depth,.4)
})
test('mesh-backed Modelica supermarket reaches detour goal without collision',async()=>{
  const scenario=supermarketModelicaScenario('detour',.72,'mesh')
  const result=toSupermarketReplay(await runModelicaScenario(scenario,directory))
  assert.equal(result.engine.model,'RealityLoopContacts.SupermarketMeshRobot')
  assert(result.result.passed)
  assert(result.result.minimumSweptClearanceMetres>.1)
  assert(result.result.maximumPenetrationMetres<=1e-8)
  assert(result.result.goalDistanceMetres<.55)
  assert(result.result.arrivalTimeSeconds!<20)
})
test('mesh-backed Modelica supermarket blocks collision and never reaches goal',async()=>{
  const scenario=supermarketModelicaScenario('blocked',.72,'mesh')
  const result=toSupermarketReplay(await runModelicaScenario(scenario,directory))
  assert.equal(result.engine.model,'RealityLoopContacts.SupermarketMeshBlocked')
  assert.equal(result.result.passed,false)
  assert.equal(result.result.failureReason,'goalNotReached')
  assert(result.result.maximumContactForceNewtons>100)
  assert(result.result.maximumPenetrationMetres>0)
  assert(Math.max(...result.observations.map(o=>o.x))<4)
})
