import {test} from 'node:test'
import {strict as assert} from 'node:assert'
import * as THREE from 'three'
import {addMarsHabitat} from '../viewer/mars-habitat.ts'
import {terrainElevation} from '../src/mission-experiments.ts'

test('modular habitat uses instancing, interface plates and support robots',()=>{
  const scene=new THREE.Scene()
  const habitat=addMarsHabitat(scene)
  const modules=scene.getObjectByName('Mars modular habitat blocks')
  assert(modules instanceof THREE.InstancedMesh)
  assert.equal(modules.count,18)
  const structure=scene.getObjectByName('Mars modular habitat assembly')
  assert(structure instanceof THREE.Group)
  const interfacePlates=structure.children.filter(
    child=>child instanceof THREE.InstancedMesh)
  assert.equal(interfacePlates.length,5)
  assert(interfacePlates.some(mesh=>mesh.count===72),
    'Four interface faces per module should be instanced')
  const utility=scene.getObjectByName('Mars six-legged cargo robot')
  assert(utility instanceof THREE.Group)
  const legs=utility.children.filter(child=>child instanceof THREE.Group)
  assert.equal(legs.length,6)
  const initial=legs[0].rotation.x
  habitat.update(9,.6)
  assert.notEqual(legs[0].rotation.x,initial)
  assert(scene.background instanceof THREE.Color)
  assert.equal(scene.background.getHex(),0xf0bd9c)
  assert(scene.fog instanceof THREE.FogExp2)
})

test('visual habitat animation leaves canonical terrain unchanged',()=>{
  const scene=new THREE.Scene()
  const model=addMarsHabitat(scene)
  const inputs:[number,number][]=[[-8,0],[-2,-.65],[3,1.15],[8,-1.5]]
  const before=inputs.map(([x,z])=>terrainElevation('mars',x,z))
  for(let frame=0;frame<8;frame++)model.update(frame*2,frame/7)
  assert.deepEqual(inputs.map(([x,z])=>terrainElevation('mars',x,z)),before)
})
