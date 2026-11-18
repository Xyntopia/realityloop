import {strict as assert} from 'node:assert'
import {test} from 'node:test'
import {constructionSoilSample} from '../viewer/construction-materials.ts'

test('procedural construction soil remains deterministic and naturally colored',()=>{
  const first=constructionSoilSample(49,173)
  assert.deepEqual(first,constructionSoilSample(49,173))
  const samples=Array.from({length:32*32},(_,i)=>
    constructionSoilSample(i%32*7,Math.floor(i/32)*7))
  const reds=samples.map(s=>s.r)
  assert(Math.max(...reds)-Math.min(...reds)>20,
    'A flat uniform soil color cannot communicate disturbed earth')
  for(const s of samples){
    assert(s.r>s.g&&s.g>s.b,
      'Soil should remain muted earth rather than blue/green noise')
    assert([s.r,s.g,s.b,s.height].every(Number.isFinite))
    assert(s.r>=0&&s.r<=255&&s.b>=0&&s.b<=255)
  }
})
