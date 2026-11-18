import {strict as assert} from 'node:assert'
import {test} from 'node:test'
import {supermarketObstacles} from '../src/geometry.ts'
import {bakedFloorOcclusion} from '../viewer/static-floor-lighting.ts'

test('static floor occlusion is stronger at shelf footprints and wall seams',()=>{
  const open=bakedFloorOcclusion(-2,0,supermarketObstacles)
  const shelf=bakedFloorOcclusion(2.1,-3.2,supermarketObstacles)
  const adjacent=bakedFloorOcclusion(2.1,-2.6,supermarketObstacles)
  const wall=bakedFloorOcclusion(-5.77,0,supermarketObstacles)
  assert(open>.94, 'open floor should not be unnaturally dark')
  assert(shelf<adjacent, 'under-shelf occlusion should dominate')
  assert(adjacent<open, 'adjacent shelf floor should have darker indirect light')
  assert(wall<open, 'floor-wall corner should have more AO than the aisle')
  for(const v of [open,shelf,adjacent,wall])assert(v>=.5&&v<=1)
  const beyondShelf=bakedFloorOcclusion(2.1,-2.1,supermarketObstacles)
  assert(beyondShelf>.97,
    'Baked shelf occlusion must not create dark halos across the open aisle')
})

test('baked occlusion uses static obstacle geometry without mutating it',()=>{
  const original=JSON.stringify(supermarketObstacles)
  const one=bakedFloorOcclusion(4.35,0,supermarketObstacles)
  const two=bakedFloorOcclusion(4.35,0,supermarketObstacles)
  assert.equal(one,two)
  assert.equal(JSON.stringify(supermarketObstacles),original)
  assert(bakedFloorOcclusion(4.35,0,[])>one)
})
