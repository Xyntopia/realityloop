import * as THREE from 'three'
import {terrainElevation} from '../src/mission-experiments.ts'

/**
 * Original procedural visual layer for the Mars concept environment.
 * Decorative habitat, arms and support robots are not contact bodies or
 * independently simulated mechanisms. The traversing rover uses the
 * canonical terrain scenario; all other motions are presentation-only.
 */
const terr=(x:number,z:number)=>terrainElevation('mars',x,z)
const orange=new THREE.MeshStandardMaterial({
  color:0xc47737,roughness:.67,metalness:.35,
})
const modularPaint=new THREE.MeshStandardMaterial({
  color:0xffffff,roughness:.61,metalness:.28,
})
const paleOrange=new THREE.MeshStandardMaterial({
  color:0xe2944c,roughness:.67,metalness:.25,
})
const frame=new THREE.MeshStandardMaterial({
  color:0x28282b,roughness:.36,metalness:.8,
})
const brushed=new THREE.MeshStandardMaterial({
  color:0xa6a29e,roughness:.41,metalness:.72,
})
const ivory=new THREE.MeshStandardMaterial({
  color:0xd6cfc2,roughness:.48,metalness:.32,
})
const joint=new THREE.MeshStandardMaterial({
  color:0x55595d,roughness:.39,metalness:.7,
})
const black=new THREE.MeshStandardMaterial({
  color:0x342b25,roughness:.52,metalness:.33,
})
const redLed=new THREE.MeshStandardMaterial({
  color:0xac351d,emissive:0x771d0e,emissiveIntensity:.45,roughness:.42,
})
const sharedBox=new THREE.BoxGeometry(1,1,1)
const tmp=new THREE.Object3D()
const unit=1.02

const block=(parent:THREE.Object3D,
  size:readonly [number,number,number],
  position:readonly [number,number,number],material:THREE.Material)=>{
  const item=new THREE.Mesh(sharedBox,material)
  item.scale.set(...size);item.position.set(...position)
  item.castShadow=true;item.receiveShadow=true
  parent.add(item);return item
}
const rod=(parent:THREE.Object3D,r:number,a:THREE.Vector3,b:THREE.Vector3,
  material:THREE.Material,geometry=new THREE.CylinderGeometry(1,1,1,10))=>{
  const item=new THREE.Mesh(geometry,material)
  const delta=b.clone().sub(a)
  item.scale.set(r,delta.length(),r)
  item.position.copy(a).add(b).multiplyScalar(.5)
  item.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize())
  item.castShadow=true;parent.add(item)
  return item
}
const vector=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z)
const sphere=(root:THREE.Object3D,r:number,p:THREE.Vector3,mat:THREE.Material)=>{
  const obj=new THREE.Mesh(new THREE.SphereGeometry(r,10,8),mat)
  obj.position.copy(p);obj.castShadow=true;root.add(obj);return obj
}

const makeSandNormal=()=>{
  const size=256
  const canvas=document.createElement('canvas')
  canvas.width=canvas.height=size
  const ctx=canvas.getContext('2d')
  if(!ctx)return null
  const rgba=ctx.createImageData(size,size)
  const height=(u:number,v:number)=>{
    const ripple=16*u+1.5*Math.sin(5*v)+.3*Math.sin(13*v)
    return .6*Math.sin(2*Math.PI*ripple)+.24*Math.sin(2*Math.PI*(22*u-5*v))
  }
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size,v=y/size,dt=1/size
    const dhdx=height(u+dt,v)-height(u-dt,v)
    const dhdy=height(u,v+dt)-height(u,v-dt)
    const n=vector(-dhdx*1.4,-dhdy*1.4,1).normalize()
    const index=4*(y*size+x)
    rgba.data[index]=Math.round(127.5*(n.x+1))
    rgba.data[index+1]=Math.round(127.5*(n.y+1))
    rgba.data[index+2]=Math.round(127.5*(n.z+1))
    rgba.data[index+3]=255
  }
  ctx.putImageData(rgba,0,0)
  const texture=new THREE.CanvasTexture(canvas)
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping
  texture.repeat.set(10,7)
  texture.colorSpace=THREE.NoColorSpace
  texture.anisotropy=4
  return texture
}

/** Far-distance terrain is visual context and explicitly excluded from
 * physical hazard clearance. Its buffers never intersect the contact plane. */
const addHorizon=(scene:THREE.Scene)=>{
  const geology=new THREE.Group();scene.add(geology)
  const distant=new THREE.MeshStandardMaterial({
    color:0xb78467,roughness:1,metalness:0,
  })
  const distantFloor=new THREE.Mesh(
    new THREE.PlaneGeometry(180,145,90,65),distant)
  distantFloor.rotation.x=-Math.PI/2
  distantFloor.position.y=-.65
  distantFloor.receiveShadow=false
  geology.add(distantFloor)
  const cliffColors=[0x9f644b,0xb0765b,0xbc886b,0x925944]
  for(let i=0;i<13;i++){
    const angle=i*2.39996323,radius=26+(i%4)*7
    const x=radius*Math.cos(angle),z=radius*Math.sin(angle)
    const base=2+(i%5)*1.15
    const mound=new THREE.Group()
    mound.position.set(x,-.6,z)
    const core=new THREE.Mesh(
      new THREE.CylinderGeometry(base*.45,base,base*(.43+.06*(i%3)),8,1),
      new THREE.MeshStandardMaterial({color:cliffColors[i%4],roughness:1,
        flatShading:true}))
    core.position.y=base*.22
    mound.add(core)
    if(i%3===0){
      const cap=new THREE.Mesh(
        new THREE.CylinderGeometry(base*.27,base*.45,base*.14,8),
        new THREE.MeshStandardMaterial({color:0xb47c5a,roughness:1}))
      cap.position.y=base*.51
      mound.add(cap)
    }
    geology.add(mound)
  }
}

/** A few InstancedMeshes replace hundreds of identical cube/port meshes. */
const createStack=(parent:THREE.Object3D)=>{
  const local=new THREE.Group()
  local.position.set(2.85,terr(2.85,3.15)+.08,3.15)
  parent.add(local)
  const stacks:readonly (readonly [number,number,number])[]=[
    [-2,0,0],[-1,0,0],[0,0,0],[1,0,0],[2,0,0],
    [-2,1,0],[-1,1,0],[0,1,0],[1,1,0],[2,1,0],
    [-1,2,0],[0,2,0],[1,2,0],[0,3,0],
    [1,0,-1],[2,0,-1],[1,1,-1],[0,0,1],
  ]
  const bodies=new THREE.InstancedMesh(sharedBox,modularPaint,stacks.length)
  bodies.name='Mars modular habitat blocks'
  local.name='Mars modular habitat assembly'
  const edges=new THREE.InstancedMesh(sharedBox,frame,stacks.length*12)
  const ports=new THREE.InstancedMesh(
    new THREE.CylinderGeometry(.25,.25,.025,24),black,stacks.length*4)
  const rings=new THREE.InstancedMesh(
    new THREE.TorusGeometry(.192,.025,8,20),brushed,stacks.length*4)
  const leds=new THREE.InstancedMesh(
    new THREE.SphereGeometry(.039,8,6),redLed,stacks.length*4)
  const qFront=new THREE.Quaternion().setFromAxisAngle(vector(1,0,0),Math.PI/2)
  const qBack=new THREE.Quaternion().setFromAxisAngle(vector(1,0,0),-Math.PI/2)
  const qSide=new THREE.Quaternion().setFromAxisAngle(vector(0,0,1),Math.PI/2)
  const frontTorus=new THREE.Quaternion()
  const backTorus=new THREE.Quaternion().setFromAxisAngle(vector(0,1,0),Math.PI)
  const sideTorus=new THREE.Quaternion().setFromAxisAngle(vector(0,1,0),Math.PI/2)
  const topTorus=new THREE.Quaternion().setFromAxisAngle(vector(1,0,0),-Math.PI/2)
  let edgeIndex=0,faceIndex=0
  for(const [index,[gx,gy,gz]] of stacks.entries()){
    const origin=vector(gx*unit,(gy+.5)*unit,gz*unit)
    tmp.position.copy(origin);tmp.scale.set(.965,.965,.965)
    tmp.quaternion.identity();tmp.updateMatrix()
    bodies.setMatrixAt(index,tmp.matrix)
    const rust= new THREE.Color(index%4===0?0xc97636:
      index%4===1?0xaf5225:index%4===2?0xe29b4d:0xc16a30)
    bodies.setColorAt(index,rust)
    for(const axis of [0,1,2]){
      for(const a of [-1,1])for(const b of [-1,1]){
        tmp.position.copy(origin)
        const pos=[a*.495,b*.495]
        const xyz:[number,number,number]=axis===0?[0,pos[0],pos[1]]:
          axis===1?[pos[0],0,pos[1]]:[pos[0],pos[1],0]
        tmp.position.add(vector(...xyz))
        const sizes:[number,number,number]=axis===0?[1.03,.042,.042]:
          axis===1?[.042,1.03,.042]:[.042,.042,1.03]
        tmp.scale.set(...sizes);tmp.updateMatrix()
        edges.setMatrixAt(edgeIndex++,tmp.matrix)
      }
    }
    for(const face of ['front','back','side','top'] as const){
      const center=origin.clone().add(
        face==='front'?vector(0,0,.496):
        face==='back'?vector(0,0,-.496):
        face==='side'?vector(.496,0,0):vector(0,.496,0))
      tmp.position.copy(center)
      tmp.scale.setScalar(1)
      tmp.quaternion.copy(face==='front'?qFront:
        face==='back'?qBack:face==='side'?qSide:new THREE.Quaternion())
      tmp.updateMatrix()
      ports.setMatrixAt(faceIndex,tmp.matrix)
      // Keep circular ports visible from either camera side of the worksite.
      tmp.quaternion.copy(face==='front'?frontTorus:
        face==='back'?backTorus:face==='side'?sideTorus:topTorus)
      tmp.updateMatrix()
      rings.setMatrixAt(faceIndex,tmp.matrix)
      tmp.position.copy(center).add(
        face==='front'?vector(0,0,.021):
        face==='back'?vector(0,0,-.021):
        face==='side'?vector(.021,0,0):vector(0,.021,0))
      tmp.quaternion.identity();tmp.scale.setScalar(1);tmp.updateMatrix()
      leds.setMatrixAt(faceIndex,tmp.matrix)
      faceIndex++
    }
  }
  for(const instanced of [bodies,edges,ports,rings,leds]){
    instanced.instanceMatrix.needsUpdate=true
    instanced.castShadow=true;instanced.receiveShadow=true
    local.add(instanced)
  }
  // A vertical sensor/communications mast and thermal canisters.
  rod(local,.028,vector(.4,3.95,.35),vector(.4,6.4,.35),brushed)
  sphere(local,.14,vector(.4,6.42,.35),black)
  for(let i=0;i<3;i++){
    block(local,[.7,.7,.75],[2.8,1.18,-.75+i*.78],brushed)
    block(local,[.76,.025,.79],[2.8,1.6,-.75+i*.78],frame)
  }
  const rack=new THREE.Group()
  rack.position.set(-2.2,.1,-1.4)
  local.add(rack)
  for(const x of [-.75,.75])for(const z of [-.4,.4])
    rod(rack,.025,vector(x,0,z),vector(x,2.15,z),frame)
  block(rack,[1.75,.05,.95],[0,2.1,0],brushed)
  for(let i=0;i<2;i++){
    const canister=new THREE.Mesh(new THREE.CylinderGeometry(.35,.35,1.75,14),
      brushed)
    canister.position.set(-.4+i*.8,1.04,0)
    rack.add(canister)
  }
  return {root:local}
}


type ArmAssembly={update:(timeSeconds:number,loading:number)=>void}
const addManipulator=(root:THREE.Object3D,origin:THREE.Vector3,
  seed:number):ArmAssembly=>{
  const pivot=new THREE.Group();pivot.position.copy(origin);root.add(pivot)
  const base=new THREE.Mesh(new THREE.CylinderGeometry(.30,.32,.15,16),frame)
  base.position.y=.08; pivot.add(base)
  const shoulder=vector(0,.25,0)
  const elbow=vector(.5,1.12,.13)
  const tip=vector(1.25,1.52,.15)
  const beamGeom=new THREE.CylinderGeometry(1,1,1,12)
  const upper=rod(pivot,.095,shoulder,elbow,ivory,beamGeom)
  const lower=rod(pivot,.082,elbow,tip,ivory,beamGeom)
  const eJoint=sphere(pivot,.154,elbow,joint)
  const sJoint=sphere(pivot,.18,shoulder,brushed)
  const claw=new THREE.Group();pivot.add(claw)
  block(claw,[.25,.1,.16],[0,0,0],joint)
  for(const z of [-.095,.095])block(claw,[.18,.045,.045],[.13,-.06,z],ivory)
  const point=(a:THREE.Vector3,b:THREE.Vector3,beam:THREE.Mesh)=>{
    const v=b.clone().sub(a)
    beam.position.copy(a).add(b).multiplyScalar(.5)
    beam.scale.set(.09,v.length(),.09)
    beam.quaternion.setFromUnitVectors(vector(0,1,0),v.normalize())
  }
  return {update:(timeSeconds,loading)=>{
    const oscillate=Math.sin(timeSeconds*.35+seed)*.22
    const a=vector(0,.25,0)
    const b=vector(.48+oscillate,1.05+loading*.25,.12+seed*.12)
    const c=vector(1.1+oscillate*.5,1.63+loading*.3,.14+seed*.17)
    point(a,b,upper);point(b,c,lower)
    eJoint.position.copy(b);sJoint.position.copy(a)
    claw.position.copy(c)
    claw.rotation.z=.25+oscillate*.35
  }}
}

const createSixLeggedUtility=(scene:THREE.Scene)=>{
  const g=new THREE.Group();scene.add(g)
  g.position.set(-1.75,terr(-1.75,-2.3)+.5,-2.3)
  g.scale.setScalar(1.25)
  g.name='Mars six-legged cargo robot'
  block(g,[1.25,.55,.92],[0,.37,0],paleOrange)
  block(g,[1.07,.18,.91],[0,.78,0],frame)
  block(g,[.83,.62,.7],[-.16,1.11,0],orange)
  block(g,[.74,.04,.75],[-.16,1.46,0],frame)
  sphere(g,.145,vector(.48,1.07,.51),redLed)
  const legs:THREE.Group[]=[]
  for(const side of [-1,1])for(let i=0;i<3;i++){
    const x=(i-1)*.48
    const hip=vector(x,.42,side*.4)
    const knee=vector(x+.18,.07,side*.88)
    const foot=vector(x+.3,-.52,side*1.18)
    const leg=new THREE.Group();g.add(leg);legs.push(leg)
    rod(leg,.08,hip,knee,ivory)
    rod(leg,.066,knee,foot,ivory)
    sphere(leg,.10,hip,joint)
    sphere(leg,.085,knee,joint)
    block(leg,[.2,.055,.19],foot.toArray() as [number,number,number],black)
  }
  return {update:(t:number)=>{
    // Low-cost small idle gait, not a validated leg dynamics solver.
    for(const [index,leg] of legs.entries())
      leg.rotation.x=.025*Math.sin(t*.7+index*1.2)
  }}
}
const createDistantRover=(scene:THREE.Scene)=>{
  const root=new THREE.Group()
  root.position.set(9.8,terr(9.8,6.15)+.42,6.15);root.scale.setScalar(.7)
  scene.add(root)
  block(root,[1.2,.4,.82],[0,.25,0],paleOrange)
  block(root,[.72,.4,.64],[.02,.7,0],frame)
  rod(root,.024,vector(-.3,.82,0),vector(-.3,1.8,0),brushed)
  for(const z of [-.51,.51])for(const x of [-.53,.53]){
    const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.31,.31,.21,14),black)
    wheel.position.set(x,.08,z);wheel.rotation.x=Math.PI/2
    root.add(wheel)
  }
}

export const addMarsHabitat=(scene:THREE.Scene)=>{
  scene.background=new THREE.Color(0xf0bd9c)
  scene.fog=new THREE.FogExp2(0xdca787,.012)
  addHorizon(scene)
  createStack(scene)
  const leftArm=addManipulator(scene,vector(1.8,terr(1.8,2.1)+1.13,2.1),.8)
  const rightArm=addManipulator(scene,vector(4.4,terr(4.4,2.0)+1.12,2.0),2.4)
  const walking=createSixLeggedUtility(scene)
  createDistantRover(scene)
  // A small weathered module staged beside the habitat.
  const transfer=new THREE.Group()
  transfer.position.set(.25,terr(.25,2.4)+.6,2.4)
  scene.add(transfer)
  block(transfer,[1,.92,1],[0,0,0],orange)
  block(transfer,[.95,.04,.95],[0,.46,0],frame)
  const face=new THREE.Mesh(new THREE.TorusGeometry(.22,.025,8,24),brushed)
  face.position.z=.5;transfer.add(face)
  const weathered=new THREE.Mesh(new THREE.CircleGeometry(.16,20),black)
  weathered.position.z=.508;transfer.add(weathered)
  return {
    update:(timeSeconds:number,roverProgress:number)=>{
      const motion=Math.max(0,Math.min(1,roverProgress))
      leftArm.update(timeSeconds,motion)
      rightArm.update(timeSeconds,1-motion)
      walking.update(timeSeconds)
      transfer.rotation.y=.04*Math.sin(timeSeconds*.33)
    },
  }
}

export const proceduralSandNormal=makeSandNormal
