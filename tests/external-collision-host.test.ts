import {strict as assert} from 'node:assert'
import {test} from 'node:test'
import {runExternalCollisionModelica} from '../src/modelica/external-host.ts'
const dir=process.env.RUMOCA_EXTERNAL_C_WASM_DIR
for(const provider of ['rapier','mujoco'] as const){
  test('Modelica C host invokes '+provider+' collision-only narrow phase',{
    skip:!dir&&'Requires locally patched Rumoca host-WASM ABI',
  },async()=>{
    const result=await runExternalCollisionModelica(dir!,provider)
    assert.equal(result.engine,'rumoca-wasm-external-c-real3')
    assert.equal(result.backend,provider)
    assert(result.calls>10)
    assert.equal(result.observations[0].depth,0)
    assert(result.maximumPenetrationMetres>.03)
    assert(result.observations.at(-1)!.x<4.3)
  })
}
