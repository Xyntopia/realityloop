import {strict as assert} from 'node:assert'
import {test} from 'node:test'
import {
  graphicsEffects,presetGraphicsEffects,resolveGraphicsEffects,
  enabledEffectCount,ceilingShadowBudget,floorShadingProfile,
} from '../viewer/graphics-settings.ts'
import {
  supermarketCeilingLampPositions,ceilingShadowIndices,
} from '../viewer/supermarket-light-layout.ts'

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

test('every high-quality ceiling fixture can cast shadows; lower tiers have bounded coverage',()=>{
  assert.equal(ceilingShadowBudget('high',true,35),35)
  assert.equal(ceilingShadowBudget('balanced',true,35),7)
  assert.equal(ceilingShadowBudget('performance',true,35),1)
  assert.equal(ceilingShadowBudget('high',true,3),3)
  for(const tier of ['high','balanced','performance'] as const){
    assert.equal(ceilingShadowBudget(tier,false,35),0)
    assert.equal(ceilingShadowBudget(tier,true,35,true),0,
      'Software WebGL should never allocate full-scene shadow maps')
  }
})

test('all thirty-five ceiling fixtures share one canonical emitter layout',()=>{
  const positions=supermarketCeilingLampPositions()
  assert.equal(positions.length,35)
  assert.equal(new Set(positions.map(({x,z})=>x+':'+z)).size,35)
  assert.deepEqual([...ceilingShadowIndices(35,35)],positions.map((_,i)=>i))
  assert.equal(ceilingShadowIndices(35,7).size,7)
  assert.equal(Math.min(...ceilingShadowIndices(35,7)),2)
  assert.equal(Math.max(...ceilingShadowIndices(35,7)),32)
})

test('floor AO and fake shelf shadows are not stacked over high-quality real shadows',()=>{
  const high=presetGraphicsEffects('high')
  const balanced=presetGraphicsEffects('balanced')
  const highProfile=floorShadingProfile('high',high)
  const balancedProfile=floorShadingProfile('balanced',balanced)
  assert.equal(highProfile.fixtureContactOpacity,0)
  assert(highProfile.bakedAO<.2)
  assert(balancedProfile.fixtureContactOpacity>0)
  assert(balancedProfile.bakedAO<.3)
  const withoutShadows=floorShadingProfile('high',{...high,castShadows:false})
  assert(withoutShadows.fixtureContactOpacity>0)
  assert(withoutShadows.bakedAO>highProfile.bakedAO)
  const withoutContact=floorShadingProfile('high',{...high,contactShadows:false})
  assert.equal(withoutContact.fixtureContactOpacity,0)
  assert.equal(withoutContact.wallSeamOpacity,0)
  assert.equal(withoutContact.bakedAO,highProfile.bakedAO,
    'Turning off contact shadows must not disable separate baked AO')
  const software=floorShadingProfile('high',high,false)
  assert(software.fixtureContactOpacity>0,
    'Without software shadow maps, subtle contact shading should remain')
  assert(software.bakedAO>highProfile.bakedAO)
})

test('SSAO is gated on unsupported renderers without disabling other effects',()=>{
  const requested=presetGraphicsEffects('high')
  const actual=resolveGraphicsEffects(requested,false)
  assert.equal(actual.ambientOcclusion,false)
  assert.equal(actual.reflections,true)
  assert.equal(actual.contactShadows,true)
  assert.equal(actual.lighting,true)
})
