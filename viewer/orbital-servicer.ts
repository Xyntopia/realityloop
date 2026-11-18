import * as THREE from 'three'
import type {OrbitalState} from '../src/orbital-formation.ts'
import type {InspectionSnapshot} from '../src/orbital-inspection.ts'

const copper=new THREE.MeshStandardMaterial({color:0xbe8a63,metalness:.66,roughness:.32})
const silver=new THREE.MeshStandardMaterial({color:0xc7d8df,metalness:.7,roughness:.32})
const ceramic=new THREE.MeshStandardMaterial({color:0xd7dedb,metalness:.25,roughness:.64})
const solar=new THREE.MeshStandardMaterial({color:0x174877,metalness:.2,roughness:.3})
const sensorGlass=new THREE.MeshStandardMaterial({
  color:0x31bfd7,metalness:.4,roughness:.22,
  emissive:0x0b445e,emissiveIntensity:.45,
})
const body=(root:THREE.Group,w:number,h:number,d:number,x:number,y:number,z:number,
  material:THREE.Material)=>{
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material)
  mesh.position.set(x,y,z)
  mesh.castShadow=true
  mesh.receiveShadow=true
  root.add(mesh)
  return mesh
}

/** Small active servicer carrying a pointing planar depth scanner.
 * Geometry and scan visualization are independent of the Kepler state. */
export const addOrbitalServicer=(scene:THREE.Scene,target:THREE.Group)=>{
  const servicer=new THREE.Group()
  servicer.name='Keplerian co-orbital inspection servicer'
  scene.add(servicer)
  body(servicer,.62,.48,.52,0,0,0,ceramic)
  for(const sign of [-1,1]){
    body(servicer,1.05,.035,.62,sign*.92,.02,0,solar)
    for(let i=0;i<5;i++)body(servicer,.014,.044,.62,sign*(.45+i*.21),.025,0,silver)
    body(servicer,.16,.08,.16,sign*.38,0,0,copper)
  }
  const detector=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,.29,24),silver)
  detector.rotation.x=Math.PI/2
  detector.position.set(0,.09,.33)
  detector.castShadow=true
  servicer.add(detector)
  const eye=new THREE.Mesh(new THREE.CircleGeometry(.16,24),sensorGlass)
  eye.position.set(0,.09,.49)
  servicer.add(eye)
  const antenna=new THREE.Mesh(new THREE.CylinderGeometry(.016,.016,.62,8),silver)
  antenna.position.set(0,.49,0)
  servicer.add(antenna)

  const maxPoints=1300
  const positions=new Float32Array(maxPoints*3)
  const mapGeometry=new THREE.BufferGeometry()
  mapGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3))
  mapGeometry.setDrawRange(0,0)
  const cloud=new THREE.Points(mapGeometry,new THREE.PointsMaterial({
    color:0x40dbf9,size:.043,transparent:true,opacity:.87,
    depthWrite:false,sizeAttenuation:true,
  }))
  cloud.frustumCulled=false
  cloud.name='Reconstructed 2D inspection map (target body frame)'
  target.add(cloud)

  const rayPositions=new Float32Array(12*2*3)
  const raysGeometry=new THREE.BufferGeometry()
  raysGeometry.setAttribute('position',new THREE.BufferAttribute(rayPositions,3))
  raysGeometry.setDrawRange(0,0)
  const rays=new THREE.LineSegments(raysGeometry,new THREE.LineBasicMaterial({
    color:0x4ecdf8,transparent:true,opacity:.18,depthWrite:false,
  }))
  rays.frustumCulled=false
  rays.name='Synthetic inspection range rays'
  scene.add(rays)
  const origin=new THREE.Vector3()
  const towardTarget=new THREE.Vector3()
  const endpoint=new THREE.Vector3()
  let lastSnapshot:InspectionSnapshot|undefined
  return {
    update:(orbital:OrbitalState,inspection?:InspectionSnapshot)=>{
      servicer.position.set(
        orbital.relativeRTN.x,orbital.relativeRTN.y,orbital.relativeRTN.z,
      )
      // +Z of the instrument faces the inspected target.
      towardTarget.copy(servicer.position).negate()
      servicer.quaternion.setFromUnitVectors(
        new THREE.Vector3(0,0,1),towardTarget.normalize(),
      )
      if(!inspection||inspection===lastSnapshot)return
      lastSnapshot=inspection
      const sampled=inspection.mapPoints.slice(-maxPoints)
      for(const [i,p] of sampled.entries()){
        positions[3*i]=p.x
        positions[3*i+1]=p.y
        positions[3*i+2]=.03
      }
      mapGeometry.attributes.position.needsUpdate=true
      mapGeometry.setDrawRange(0,sampled.length)
      // The scan is planar in the target body frame. Convert its sample
      // points to the tracked spacecraft's 3D orientation for rays.
      target.updateMatrixWorld(true)
      origin.copy(servicer.position)
      let raysUsed=0
      for(let i=0;i<inspection.scanPoints.length&&raysUsed<12;i+=6){
        const p=inspection.scanPoints[i]!
        endpoint.set(p.x,p.y,.03).applyMatrix4(target.matrixWorld)
        if(endpoint.distanceTo(origin)>30)continue
        const j=raysUsed*6
        rayPositions[j]=origin.x;rayPositions[j+1]=origin.y;rayPositions[j+2]=origin.z
        rayPositions[j+3]=endpoint.x;rayPositions[j+4]=endpoint.y;rayPositions[j+5]=endpoint.z
        raysUsed++
      }
      raysGeometry.attributes.position.needsUpdate=true
      raysGeometry.setDrawRange(0,raysUsed*2)
    },
  }
}
