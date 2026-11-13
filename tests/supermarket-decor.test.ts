import {strict as assert} from 'node:assert'
import {test} from 'node:test'
import {supermarketObstacles,type Obstacle} from '../src/geometry.ts'
import {palletCartonLayout} from '../viewer/supermarket-decor.ts'

test('photographic pallet stays inside the authoritative obstruction',()=>{
  const original=supermarketObstacles.find(o=>o.kind==='obstruction')!
  const scenarios:Obstacle[]=[
    original,
    {...original,halfX:.24,halfZ:.7,height:.9},
    {...original,halfX:.8,halfZ:2,height:2.8},
  ]
  for(const obstacle of scenarios){
    const boxes=palletCartonLayout(obstacle)
    assert.equal(boxes.length,60)
    assert.deepEqual(boxes,palletCartonLayout(obstacle))
    for(const box of boxes){
      assert.ok(box.width>0&&box.depth>0&&box.height>0)
      assert.ok(Math.abs(box.x-obstacle.x)+box.width/2<=obstacle.halfX)
      assert.ok(Math.abs(box.z-obstacle.z)+box.depth/2<=obstacle.halfZ)
      assert.ok(box.y-box.height/2>=0)
      assert.ok(box.y+box.height/2<=obstacle.height)
    }
  }
})
