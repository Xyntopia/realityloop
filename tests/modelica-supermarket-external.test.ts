import {strict as assert} from 'node:assert'
import {test} from 'node:test'
import {runModelicaScenario} from '../src/modelica/node.ts'
import {parseModelicaScenario} from '../src/modelica/runtime.ts'
import {runExternalSupermarketModelica}
  from '../src/modelica/supermarket-external.ts'

const directory=process.env.RUMOCA_EXTERNAL_C_WASM_DIR
const base={
  name:'supermarket-external-test',kind:'modelica' as const,
  model:'RealityLoopContacts.SupermarketExternalBlocked',
  collisionBackend:'rapier' as const,
  durationSeconds:10,intervalSeconds:.05,
  frictionCoefficient:.72,motorTorqueNewtonMetres:135,
}
test('external collision requires explicit backend and patched host',async()=>{
  assert.throws(()=>parseModelicaScenario({...base,collisionBackend:undefined}))
  assert.throws(()=>parseModelicaScenario({
    ...base,model:'RealityLoopContacts.SupermarketBlocked',
  }))
  await assert.rejects(runModelicaScenario(parseModelicaScenario(base)),
    /patched Rumoca host/)
})
for(const backend of ['rapier','mujoco'] as const){
  test('patched Rumoca calls '+backend+' from full Modelica vehicle dynamics',{
    skip:!directory&&'Patched Rumoca callback WASM required',
  },async()=>{
    const run=await runExternalSupermarketModelica(directory!,backend,'blocked',10,.05)
    assert.equal(run.provider,backend)
    assert.equal(run.model.scenario.collisionBackend,backend)
    assert(run.callbacks>1000)
    assert(run.detectedContacts>100)
    assert(run.replay.result.maximumPenetrationMetres>.04)
    assert(run.replay.result.maximumContactForceNewtons>100)
    assert(run.replay.observations.at(-1)!.x<4)
    assert.equal(run.replay.result.passed,false)
    assert.match(run.compilerHash,/^[a-f0-9]{64}$/)
    assert.match(run.modelHash,/^[a-f0-9]{64}$/)
  })
}
