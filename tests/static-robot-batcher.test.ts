import {strict as assert} from 'node:assert'
import {test} from 'node:test'
import * as THREE from 'three'
import {createStaticRobotBatcher} from '../viewer/static-robot-batcher.ts'

test('static body batches boxes and wheels of one material into one mesh',()=>{
  const root=new THREE.Group()
  const material=new THREE.MeshStandardMaterial({color:0x234567})
  const {box,cylinder,flush}=createStaticRobotBatcher(root)
  box(2,.5,.7,-.1,.2,0,material)
  box(.5,.3,.8,.4,.7,0,material,.15)
  cylinder(.15,.1,-.5,.15,.4,material,'z')
  flush()
  assert.equal(root.children.length,1)
  const mesh=root.children[0] as THREE.BatchedMesh
  assert.equal(mesh.name,'Static Tennant body by material')
  const matrix=new THREE.Matrix4()
  const position=new THREE.Vector3()
  const scale=new THREE.Vector3()
  const rotation=new THREE.Quaternion()
  mesh.getMatrixAt(0,matrix)
  matrix.decompose(position,rotation,scale)
  assert.ok(position.distanceTo(new THREE.Vector3(-.1,.2,0))<1e-6)
  assert.ok(scale.distanceTo(new THREE.Vector3(2,.5,.7))<1e-6)
  mesh.getMatrixAt(2,matrix)
  matrix.decompose(position,rotation,scale)
  assert.ok(position.distanceTo(new THREE.Vector3(-.5,.15,.4))<1e-6)
  assert.ok(scale.distanceTo(new THREE.Vector3(.15,.1,.15))<1e-6)
  mesh.geometry.dispose()
  material.dispose()
})
