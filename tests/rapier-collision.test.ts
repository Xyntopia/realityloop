import {strict as assert} from 'node:assert'
import {test} from 'node:test'
import {createRapierCollisionScene} from '../src/collision/rapier.ts'
import {createExternalCollisionQuery,collisionProviders} from '../src/collision/contract.ts'
import {supermarketObstacles} from '../src/geometry.ts'

test('Rapier provides query-only collision contacts without stepping a world',async()=>{
  const scene=await createRapierCollisionScene()
  try{
    assert.deepEqual(scene.query({x:0,z:0,yaw:0}),[])
    for(const o of supermarketObstacles){
      const c=scene.query({x:o.x,z:o.z,yaw:0})
      assert(c.some(v=>v.obstacleId===o.id&&v.penetrationMetres>0),o.id)
    }
    const point=scene.query({x:3.8,z:0,yaw:0})
      .find(v=>v.obstacleId==='blocked-aisle')
    assert(point)
    assert(point.penetrationMetres>.2)
    assert(point.normalX<-.9)
    assert(Math.abs(point.normalZ)<.1)
    assert.deepEqual(scene.query({x:3.8,z:0,yaw:0}),
      scene.query({x:3.8,z:0,yaw:0}))
  }finally{scene.close()}
  assert.throws(()=>scene.query({x:0,z:0,yaw:0}))
})
test('provider metadata marks all queries as non-integrating',async()=>{
  assert.equal(collisionProviders.modelica.runtime,'compiled')
  assert(Object.values(collisionProviders).every(v=>!v.integratesDynamics))
  const scene=await createExternalCollisionQuery('rapier')
  try{assert(scene.query({x:0,z:0,yaw:0}).length===0)}
  finally{scene.close()}
})
