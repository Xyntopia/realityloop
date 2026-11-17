import * as THREE from 'three'
import {terrainElevation} from '../src/mission-experiments.ts'

/** Decorative construction assets. Canonical hazards, wheel traction,
 * and exclusion-zone checks remain defined by mission-experiments.ts.
 * Materials and geometry are generated locally; no imported reference art.
 */
const steel=new THREE.MeshStandardMaterial({color:0x5b6872,metalness:.78,roughness:.42})
const dark=new THREE.MeshStandardMaterial({color:0x283039,metalness:.48,roughness:.61})
const safety=new THREE.MeshStandardMaterial({color:0xe6a126,metalness:.32,roughness:.58})
const concrete=new THREE.MeshStandardMaterial({color:0x9d9b93,metalness:.02,roughness:.9})
const rust=new THREE.MeshStandardMaterial({color:0x8b5940,metalness:.19,roughness:.87})
const tyre=new THREE.MeshStandardMaterial({color:0x1b2023,roughness:.95})
const glass=new THREE.MeshStandardMaterial({
  color:0x688995,roughness:.17,metalness:.3,transparent:true,opacity:.87,
})
const sharedBox=new THREE.BoxGeometry(1,1,1)
const sharedBeam=new THREE.CylinderGeometry(1,1,1,12)
const sharedWheel=new THREE.CylinderGeometry(1,1,1,20)

const box=(root:THREE.Object3D,scale:readonly [number,number,number],
  position:readonly [number,number,number],material:THREE.Material)=>{
  const mesh=new THREE.Mesh(sharedBox,material)
  mesh.position.set(...position)
  mesh.scale.set(...scale)
  mesh.castShadow=true;mesh.receiveShadow=true
  root.add(mesh)
  return mesh
}
const beam=(root:THREE.Object3D,a:THREE.Vector3,b:THREE.Vector3,
  radius:number,material:THREE.Material)=>{
  const mesh=new THREE.Mesh(sharedBeam,material)
  const delta=b.clone().sub(a)
  mesh.position.copy(a).add(b).multiplyScalar(.5)
  mesh.scale.set(radius,delta.length(),radius)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize())
  mesh.castShadow=true;root.add(mesh)
  return mesh
}
const v=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z)
const ground=(x:number,z:number)=>terrainElevation('construction',x,z)

export const proceduralConstructionGroundNormal=()=>{
  // One inexpensive repeatable texture describes small gravel/ruts; it
  // deliberately carries no color image or external site material.
  const canvas=document.createElement('canvas')
  canvas.width=canvas.height=192
  const ctx=canvas.getContext('2d')
  if(!ctx)throw Error('Construction ground canvas unsupported')
  const rgba=ctx.createImageData(192,192)
  const height=(u:number,v:number)=>
    .30*Math.sin(u*73+Math.sin(v*23)*.6)
    +.27*Math.sin(v*109+u*19)
    +.12*Math.sin(u*213+v*91)
  for(let y=0;y<192;y++)for(let x=0;x<192;x++){
    const u=x/192,v=y/192
    const du=height(u+1/192,v)-height(u-1/192,v)
    const dv=height(u,v+1/192)-height(u,v-1/192)
    const n=new THREE.Vector3(-du*1.1,-dv*1.1,1).normalize()
    const i=(y*192+x)*4
    rgba.data[i]=Math.round((n.x+1)*127.5)
    rgba.data[i+1]=Math.round((n.y+1)*127.5)
    rgba.data[i+2]=Math.round((n.z+1)*127.5)
    rgba.data[i+3]=255
  }
  ctx.putImageData(rgba,0,0)
  const texture=new THREE.CanvasTexture(canvas)
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping
  texture.repeat.set(9,7)
  texture.colorSpace=THREE.NoColorSpace
  texture.anisotropy=4
  return texture
}

const softShadowTexture=()=>{
  const canvas=document.createElement('canvas')
  canvas.width=canvas.height=96
  const ctx=canvas.getContext('2d')
  if(!ctx)throw Error('Construction shadow canvas unsupported')
  const gradient=ctx.createRadialGradient(48,48,3,48,48,46)
  gradient.addColorStop(0,'rgba(0,0,0,.67)')
  gradient.addColorStop(.4,'rgba(0,0,0,.32)')
  gradient.addColorStop(1,'rgba(0,0,0,0)')
  ctx.fillStyle=gradient;ctx.fillRect(0,0,96,96)
  return new THREE.CanvasTexture(canvas)
}
export const addConstructionContactShadow=(root:THREE.Object3D,
  w:number,d:number,y=.05)=>{
  // Each scene owns its texture; scene-switch disposal cannot invalidate
  // a module-level cache used by the next GPU scene.
  const shadowTexture=softShadowTexture()
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(w,d),
    new THREE.MeshBasicMaterial({
      map:shadowTexture,transparent:true,depthWrite:false,
      polygonOffset:true,polygonOffsetFactor:-2,
      opacity:.65,
    }))
  shadow.rotation.x=-Math.PI/2
  shadow.position.y=y
  shadow.renderOrder=1
  shadow.name='Soft ground contact approximation'
  root.add(shadow)
  return shadow
}

const siteSky=(scene:THREE.Scene)=>{
  // A consistent blue-sky / dusty-horizon palette is preferable to the
  // artificial bright circular bloom produced by a giant shader sphere.
  // The actual sun is a shadow-casting directional light in mission-scene.
  scene.background=new THREE.Color(0x9dbbd3)
  scene.fog=new THREE.Fog(0xc5c6bc,32,115)
}

const addRoad= (root:THREE.Group)=>{
  const road=new THREE.Group();root.add(road)
  const dirt=new THREE.MeshStandardMaterial({color:0x8f816b,roughness:1})
  const gravel=new THREE.MeshStandardMaterial({color:0xa49a87,roughness:1})
  const dirtPatch=new THREE.Mesh(new THREE.PlaneGeometry(22,5),dirt)
  dirtPatch.rotation.x=-Math.PI/2
  dirtPatch.rotation.z=-.13
  dirtPatch.position.set(-.2,.025,-.4)
  dirtPatch.receiveShadow=true;road.add(dirtPatch)
  // Parallel compacted tyre paths run toward the active site.
  for(const z of [-1.48,-.58,.46,1.36]){
    const track=new THREE.Mesh(new THREE.PlaneGeometry(20,.15),gravel)
    track.rotation.x=-Math.PI/2
    track.position.set(-.3,.038,z)
    track.renderOrder=2;road.add(track)
  }
  // Earth piles and exposed aggregate soften the overly boxy floor.
  const stones=new THREE.Group();root.add(stones)
  const materials=[rust,concrete,dirt]
  const geoms=[new THREE.IcosahedronGeometry(1,0),
    new THREE.IcosahedronGeometry(1,1)]
  for(let i=0;i<75;i++){
    const x=-12+(i*2.017)%24
    const z=-7+(i*3.713)%14
    if(Math.abs(z)<2.1||Math.hypot(x+1,z+1.55)<1.8)continue
    const rock=new THREE.Mesh(geoms[i%2],materials[i%materials.length])
    const size=.08+(i%6)*.065
    rock.scale.set(size*(1.3+(i%3)*.3),size*.56,size)
    rock.position.set(x,ground(x,z)+size*.3,z)
    rock.castShadow=true;stones.add(rock)
  }
  for(const [x,z,scale] of [[-11,-4,1.2],[9,4.7,1.1],[4,6,1.6]]){
    const pile=new THREE.Mesh(new THREE.ConeGeometry(scale,scale*.8,13,1),
      rust)
    pile.position.set(x,ground(x,z)+scale*.29,z)
    pile.scale.y=.7
    pile.castShadow=true;stones.add(pile)
  }
}

/** A small wheeled excavator with meaningful silhouette rather than
 * stacked boxes. It is a static prop, not an excavator dynamics model. */
const addExcavator=(root:THREE.Group)=>{
  const machine=new THREE.Group()
  machine.name='Decorative wheeled excavator'
  machine.position.set(-5.7,ground(-5.7,4.05),4.05)
  machine.rotation.y=.26
  root.add(machine)
  addConstructionContactShadow(machine,4.0,2.7)
  box(machine,[2.2,.38,1.3],[0,.69,0],safety)
  box(machine,[1.3,.12,1.22],[-.3,1.03,0],dark)
  box(machine,[1.02,1.1,.98],[-.62,1.51,0],safety)
  box(machine,[.89,.74,.9],[-.62,1.55,.055],glass)
  box(machine,[.43,.12,1.35],[.74,1.09,0],steel)
  for(const x of [-.78,.82])for(const z of [-.76,.76]){
    const wheel=new THREE.Mesh(sharedWheel,tyre)
    wheel.scale.set(.38,.27,.38)
    wheel.position.set(x,.41,z)
    wheel.rotation.x=Math.PI/2
    wheel.castShadow=true;machine.add(wheel)
    const hub=new THREE.Mesh(sharedWheel,steel)
    hub.scale.set(.18,.30,.18)
    hub.position.copy(wheel.position);hub.rotation.x=Math.PI/2
    machine.add(hub)
  }
  const shoulder=v(.45,1.25,.1)
  const elbow=v(1.72,2.48,.12)
  const wrist=v(3.18,1.48,.12)
  beam(machine,shoulder,elbow,.15,safety)
  beam(machine,v(.74,1.29,-.2),v(1.58,2.4,-.2),.05,steel)
  beam(machine,elbow,wrist,.112,safety)
  beam(machine,v(1.83,2.35,-.15),v(2.91,1.65,-.15),.04,steel)
  for(const point of [shoulder,elbow,wrist]){
    const axle=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,.25,16),steel)
    axle.position.copy(point)
    axle.rotation.x=Math.PI/2;machine.add(axle)
  }
  const bucket=box(machine,[.82,.42,.85],[3.34,1.17,.12],dark)
  bucket.rotation.z=-.45
  for(let i=-1;i<=1;i++)
    box(machine,[.11,.22,.11],[3.69,1.01,i*.29],steel)
}

/** Makes the crane structurally recognizable using a low-count truss. */
const addCraneDetail=(root:THREE.Group)=>{
  const crane=new THREE.Group()
  crane.position.set(7.0,ground(7,4.7),4.7)
  crane.name='Decorative tower crane truss'
  root.add(crane)
  const yellow=new THREE.MeshStandardMaterial({
    color:0xd4a12b,metalness:.34,roughness:.56,
  })
  for(let y=0;y<7;y++){
    for(const x of [-.29,.29])for(const z of [-.29,.29])
      beam(crane,v(x,y,z),v(x,y+1,z),.028,yellow)
    for(const z of [-.29,.29]){
      beam(crane,v(-.29,y,z),v(.29,y+1,z),.017,steel)
      beam(crane,v(.29,y,z),v(-.29,y+1,z),.017,steel)
    }
  }
  for(let i=0;i<11;i++){
    const x=-5.1+i*.9
    beam(crane,v(x,7,.0),v(x+.55,7.45,0),.028,yellow)
    beam(crane,v(x,7,0),v(x+.9,7,0),.032,yellow)
    if(i%2===0)
      beam(crane,v(x,7.1,-.26),v(x+.6,7.1,.26),.018,steel)
  }
  // Winch and payload cable hanging from the working boom.
  box(crane,[.65,.5,.56],[1.3,7.3,0],dark)
  beam(crane,v(-3.0,7,0),v(-3.0,3.7,0),.018,steel)
  const hook=new THREE.Mesh(new THREE.TorusGeometry(.17,.035,8,16),dark)
  hook.position.set(-3,3.55,0);crane.add(hook)
  for(let i=0;i<4;i++)
    box(crane,[.5,.27,.65],[3+i*.15,6.98-i*.28,0],concrete)
  addConstructionContactShadow(crane,1.7,1.7)
}

const makeConcreteBuilding=(root:THREE.Group)=>{
  const building=new THREE.Group()
  building.position.set(3.2,ground(3.2,6.6),6.6)
  building.name='Incomplete concrete structure'
  root.add(building)
  for(let level=0;level<2;level++){
    const y=level*2.2
    for(const x of [-1.6,0,1.6])for(const z of [-.75,.75])
      box(building,[.21,2.2,.21],[x,y+1.1,z],concrete)
    box(building,[3.8,.21,2.1],[0,y+2.13,0],concrete)
  }
  for(let i=0;i<11;i++)
    beam(building,v(-1.7+i*.33,4.4,-.78),
      v(-1.7+i*.33,5.02,-.78),.016,steel)
  addConstructionContactShadow(building,4.0,2.6)
}

const addPallets=(root:THREE.Group)=>{
  const pallets=new THREE.Group()
  pallets.position.set(5.0,ground(5,1.9),1.9)
  root.add(pallets)
  for(let i=0;i<4;i++){
    const x=(i%2)*1.25,z=Math.floor(i/2)*1.16
    for(let j=0;j<3;j++)
      box(pallets,[.95,.34,.85],[x,.25+j*.35,z],
        j%2?concrete:rust)
    box(pallets,[1.0,.09,.90],[x,.07,z],steel)
    const shadow=addConstructionContactShadow(pallets,.95,.8,.015)
    shadow.position.x=x;shadow.position.z=z
  }
}

export const addConstructionSite=(scene:THREE.Scene)=>{
  siteSky(scene)
  const root=new THREE.Group()
  root.name='Construction presentation assets (not collision geometry)'
  scene.add(root)
  addRoad(root)
  addExcavator(root)
  addCraneDetail(root)
  makeConcreteBuilding(root)
  addPallets(root)
  return root
}
