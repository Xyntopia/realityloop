import {strict as assert} from 'node:assert'
import {test} from 'node:test'
import {earthCloudAlpha} from '../src/earth-clouds.ts'
import {sampleMartianRegolith} from '../viewer/mars-materials.ts'

test('clouds wrap seamlessly at the 180 degree longitude seam',()=>{
  for(const latitude of [0,.05,.23,.51,.78,.95,1]){
    for(const layer of [0,1]){
      assert.equal(earthCloudAlpha(0,latitude,layer),
        earthCloudAlpha(1,latitude,layer))
      assert.equal(earthCloudAlpha(-.12,latitude,layer),
        earthCloudAlpha(.88,latitude,layer))
    }
  }
})
test('procedural cloud belts have meaningful cover and leave clear areas',()=>{
  const cover=[]
  for(let lat=0;lat<=40;lat++)for(let lon=0;lon<=80;lon++)
    cover.push(earthCloudAlpha(lon/80,lat/40,0))
  assert(cover.some(a=>a>180))
  assert(cover.some(a=>a===0))
  assert(new Set(cover).size>80)
})

test('Mars regolith samples are deterministic and include iron-rich sediment and dark chips',()=>{
  const s=sampleMartianRegolith(24,180)
  assert.deepEqual(s,sampleMartianRegolith(24,180))
  const pixels=Array.from({length:2048},(_,i)=>
    sampleMartianRegolith(i%64*4,Math.floor(i/64)*8))
  const unique=new Set(pixels.map(p=>p.r+':'+p.g+':'+p.b))
  assert(unique.size>100)
  for(const p of pixels){
    assert(p.r>p.g&&p.g>p.b)
    assert(p.height>=0&&p.height<=1)
  }
})
