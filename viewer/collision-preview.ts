import * as THREE from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import assetUrl from '../assets/meshes/supermarket-layout.glb?url&no-inline'
import {supermarketObstacles} from '../src/geometry.ts'

/** Displays the *actual GLB collision bodies*, not independently modelled
 * debug boxes. The high-detail shelves remain separately authored PBR art. */
export const loadSupermarketCollisionOverlay=async(scene:THREE.Scene)=>{
  const gltf=await new GLTFLoader().loadAsync(assetUrl)
  const group=gltf.scene
  group.name='Canonical GLB collision overlay'
  group.visible=false
  let seen=0
  group.traverse(node=>{
    if(!(node instanceof THREE.Mesh))return
    const id=node.userData?.realityloopCollider?.id
    if(typeof id!=='string'||!supermarketObstacles.some(o=>o.id===id))
      throw Error('GLB collision node has unknown ID: '+String(id))
    seen++
    const color=id==='blocked-aisle'?0xffaa55:0x47c8e2
    const edges=new THREE.LineSegments(
      new THREE.EdgesGeometry(node.geometry),
      new THREE.LineBasicMaterial({color,depthTest:false,transparent:true,opacity:.97}),
    )
    edges.renderOrder=98
    node.add(edges)
    node.material=new THREE.MeshBasicMaterial({
      color,transparent:true,opacity:.13,depthWrite:false,
      depthTest:false,side:THREE.DoubleSide,
    })
    node.renderOrder=97
  })
  if(seen!==supermarketObstacles.length)
    throw Error('GLB collision overlay does not match the compiled scene')
  scene.add(group)
  return group
}
