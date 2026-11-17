import {strict as assert} from 'node:assert'
import {test} from 'node:test'
import {shouldCaptureSensorPreview,updateAutoQuality,type AutoQualityState} from '../viewer/render-policy.ts'
import {useScreenSpaceAO} from '../viewer/supermarket-postfx.ts'

test('secondary RGB render is skipped whenever its panel cannot be seen',()=>{
  const base={now:1200,lastCapture:500,quality:'high' as const}
  assert.equal(shouldCaptureSensorPreview({...base,panelsVisible:true,pageVisible:true}),true)
  assert.equal(shouldCaptureSensorPreview({...base,panelsVisible:false,pageVisible:true}),false)
  assert.equal(shouldCaptureSensorPreview({...base,panelsVisible:true,pageVisible:false}),false)
})

test('sensor camera preview stays rate-limited at every graphics quality',()=>{
  for(const [quality,period] of [
    ['high',150],['balanced',350],['performance',900],
  ] as const){
    const base={now:1500,lastCapture:1500-period,quality,panelsVisible:true,pageVisible:true}
    assert.equal(shouldCaptureSensorPreview(base),true)
    assert.equal(shouldCaptureSensorPreview({...base,now:1499}),false)
  }
})

test('screen-space AO is high quality and hardware-only; fast tiers use contact shading',()=>{
  for(const quality of ['performance','balanced'] as const){
    assert.equal(useScreenSpaceAO(quality,false,true),false)
  }
  assert.equal(useScreenSpaceAO('high',false,true),true)
  assert.equal(useScreenSpaceAO('high',true,true),false)
  assert.equal(useScreenSpaceAO('high',false,false),false)
})

test('auto graphics degrades quickly but upgrades only after sustained headroom',()=>{
  let state:AutoQualityState={quality:'balanced',slowWindows:0,fastWindows:0}
  state=updateAutoQuality(state,18)
  assert.equal(state.quality,'balanced')
  state=updateAutoQuality(state,18)
  assert.equal(state.quality,'performance')
  for(let i=0;i<3;i++)state=updateAutoQuality(state,59)
  assert.equal(state.quality,'performance')
  state=updateAutoQuality(state,59)
  assert.equal(state.quality,'balanced')
  for(let i=0;i<4;i++)state=updateAutoQuality(state,59)
  assert.equal(state.quality,'high')
  for(let i=0;i<2;i++)state=updateAutoQuality(state,20)
  assert.equal(state.quality,'balanced')
  assert.deepEqual(updateAutoQuality(state,35),{
    quality:'balanced',slowWindows:0,fastWindows:0,
  })
})
