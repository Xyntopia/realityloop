import {strict as assert} from 'node:assert'
import {test} from 'node:test'
import {importCollisionGeometry} from '../src/collision/mesh-formats.ts'
import {buildCollisionBVH,queryCollisionBVH} from '../src/collision/bvh.ts'
import {toBoxColliders} from '../src/collision/mesh-import.ts'

const encode=(s:string)=>new TextEncoder().encode(s)
const obj=encode(`
# No external MTL; geometry only.
v 0 0 0
v 1 0 0
v 1 1 0
v 0 1 0
f 1 2 3 4
`)
test('OBJ importer triangulates a convex polygon without treating it as a box',()=>{
  const asset=importCollisionGeometry(obj,'obj','panel')
  assert.equal(asset.colliders.length,1)
  const mesh=asset.colliders[0]
  assert.equal(mesh.type,'mesh')
  assert.deepEqual(mesh.triangles,[[0,1,2],[0,2,3]])
  assert.deepEqual(mesh.bounds,{min:[0,0,0],max:[1,1,0]})
  assert.throws(()=>toBoxColliders(asset),/narrow-phase/)
})
test('unsafe concave and nonplanar OBJ n-gons fail instead of producing overlapping collision triangles',()=>{
  const concave=encode(`v 0 0 0
v 2 0 0
v 1 0.5 0
v 2 2 0
v 0 2 0
f 1 2 3 4 5`)
  const nonplanar=encode(`v 0 0 0
v 1 0 0
v 1 1 0.1
v 0 1 0
f 1 2 3 4`)
  assert.throws(()=>importCollisionGeometry(concave,'obj'),/concave/)
  assert.throws(()=>importCollisionGeometry(nonplanar,'obj'),/planar/)
})
test('ASCII STL and binary STL preserve the same indexed triangle',()=>{
  const ascii=encode(`solid tri
  facet normal 0 0 1
    outer loop
      vertex 0 0 0
      vertex 1 0 0
      vertex 0 1 0
    endloop
  endfacet
endsolid tri
`)
  const binary=new Uint8Array(134)
  const d=new DataView(binary.buffer)
  d.setUint32(80,1,true)
  for(const [i,v] of [0,0,0,1,0,0,0,1,0].entries())
    d.setFloat32(84+12+i*4,v,true)
  const a=importCollisionGeometry(ascii,'stl','triangle')
  const b=importCollisionGeometry(binary,'stl','triangle')
  assert.deepEqual(a,b)
  assert.equal(a.colliders[0].triangles.length,1)
})
test('all imported meshes have bounded deterministic BVH and conservative broad-phase',()=>{
  const mesh=importCollisionGeometry(obj,'obj','panel').colliders[0]
  const a=buildCollisionBVH(mesh,1)
  assert.deepEqual(a,buildCollisionBVH(mesh,1))
  assert(a.nodes.length>=3)
  assert.deepEqual(queryCollisionBVH(mesh,a,[-.1,-.1,-.1],[.1,.1,.1]),[0,1])
  assert.deepEqual(queryCollisionBVH(mesh,a,[10,10,10],[11,11,11]),[])
  assert.throws(()=>buildCollisionBVH(mesh,0))
  assert.throws(()=>queryCollisionBVH(mesh,a,[NaN,0,0],[1,1,1]))
})
test('invalid format geometry refuses missing faces and nonfinite values',()=>{
  assert.throws(()=>importCollisionGeometry(encode('v 0 0 0'),'obj'),/triangle count/)
  assert.throws(()=>importCollisionGeometry(encode('v 0 NaN 0\nf 1 1 1'),'obj'),/nonfinite/)
  assert.throws(()=>importCollisionGeometry(encode('vertex 0 0 0'),'stl'),/facet/)
  assert.throws(()=>importCollisionGeometry(obj,'obj','../escape'),/ID/)
})
