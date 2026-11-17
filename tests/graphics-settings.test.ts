import {strict as assert} from 'node:assert'
import {test} from 'node:test'
import {
  graphicsEffects,presetGraphicsEffects,resolveGraphicsEffects,
  enabledEffectCount,ceilingShadowBudget,
} from '../viewer/graphics-settings.ts'

test('realistic, balanced and performance presets have meaningful tiers',()=>{
  const realistic=presetGraphicsEffects('high')
  const balanced=presetGraphicsEffects('balanced')
  const performance=presetGraphicsEffects('performance')
  assert.equal(graphicsEffects.length,7)
  assert.equal(enabledEffectCount(realistic),7)
  assert.equal(enabledEffectCount(balanced),6)
  assert.equal(enabledEffectCount(performance),0)
  assert.equal(realistic.ambientOcclusion,true)
  assert.equal(balanced.ambientOcclusion,false)
  assert.equal(performance.reflections,false)
  assert.equal(performance.surfaceDetail,false)
})

test('custom graphics switches remain independent and cannot cause disconnected glare',()=>{
  const balanced=presetGraphicsEffects('balanced')
  const custom=resolveGraphicsEffects({
    ...balanced,lighting:false,ambientOcclusion:true,reflections:false,
  },true)
  assert.equal(custom.lighting,false)
  assert.equal(custom.glare,false)
  assert.equal(custom.ambientOcclusion,true)
  assert.equal(custom.reflections,false)
  assert.equal(custom.contactShadows,true)
  assert.equal(custom.castShadows,false,'No dynamic shadows from disabled lamp sources')
  assert.equal(balanced.lighting,true,'preset must remain immutable')
})

test('dynamic ceiling-shadow map budget is bounded by graphics tier',()=>{
  assert.equal(ceilingShadowBudget('high',true),2)
  assert.equal(ceilingShadowBudget('balanced',true),1)
  assert.equal(ceilingShadowBudget('performance',true),1)
  for(const tier of ['high','balanced','performance'] as const)
    assert.equal(ceilingShadowBudget(tier,false),0)
})

test('SSAO is gated on unsupported renderers without disabling other effects',()=>{
  const requested=presetGraphicsEffects('high')
  const actual=resolveGraphicsEffects(requested,false)
  assert.equal(actual.ambientOcclusion,false)
  assert.equal(actual.reflections,true)
  assert.equal(actual.contactShadows,true)
  assert.equal(actual.lighting,true)
})
