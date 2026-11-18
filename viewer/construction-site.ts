import * as THREE from 'three'
import {terrainElevation} from '../src/mission-experiments.ts'
import {
  proceduralConcreteMap,proceduralConstructionPaintMap,
} from './construction-materials.ts'
export {proceduralConstructionGroundMaps} from './construction-materials.ts'

/** Decorative construction assets. Canonical hazards, wheel traction,
 * and exclusion-zone checks remain defined by mission-experiments.ts.
 * Materials and geometry are generated locally; no imported reference art.
 */
const steel=new THREE.MeshStandardMaterial({color:0x5b6872,metalness:.78,roughness:.42})
const dark=new THREE.MeshStandardMaterial({color:0x283039,metalness:.48,roughness:.61})
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
const deterministicUnit=(n:number)=>{
  const t=Math.sin(n*127.1+17.3)*43758.5453
  return t-Math.floor(t)
}

// The ground's diffuse and normal maps share one deterministic height field;
// the material generator lives in construction-materials.ts.

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
  scene.background=new THREE.Color(0xb4c5cd)
  scene.fog=new THREE.Fog(0xb9b9ae,30,100)
}

const addRoad=(root:THREE.Group)=>{
  // A graded, wheel-rutted lane follows the terrain visually. It is NOT a
  // traction or collision input; the scenario remains the source of truth.
  const lane=new THREE.PlaneGeometry(23,5.5,86,18)
  const vertices=lane.attributes.position
  const colors=new Float32Array(vertices.count*4)
  const c=new THREE.Color()
  for(let i=0;i<vertices.count;i++){
    const x=vertices.getX(i)-.5,z=-vertices.getY(i)
    const grooves=Math.exp(-(((Math.abs(z)-.72)/.28)**2))
    const mottling=.11*Math.sin(x*.85+z*1.15)+.07*Math.cos(x*2.1-z*1.2)
    const edge=Math.min(1,Math.max(0,(2.75-Math.abs(z))/.75))
    c.set(0x665443).multiplyScalar(.94+mottling-.18*grooves)
    vertices.setX(i,x)
    vertices.setZ(i,ground(x,z)+.032)
    const at=i*4
    colors[at]=c.r;colors[at+1]=c.g;colors[at+2]=c.b
    colors[at+3]=.75*edge
  }
  lane.setAttribute('color',new THREE.BufferAttribute(colors,4))
  lane.computeVertexNormals()
  const road=new THREE.Mesh(lane,new THREE.MeshStandardMaterial({
    vertexColors:true,transparent:true,depthWrite:false,roughness:1,
    polygonOffset:true,polygonOffsetFactor:-1,side:THREE.DoubleSide,
  }))
  road.rotation.x=-Math.PI/2
  road.receiveShadow=true;road.name='Compacted and rutted site lane'
  root.add(road)

  // Parallel impressions made by previous vehicle passes, using one draw
  // call for hundreds of local tread imprints instead of flat striped roads.
  const treadCount=176
  const treads=new THREE.InstancedMesh(
    new THREE.PlaneGeometry(.135,.22),
    new THREE.MeshBasicMaterial({
      color:0x352b24,transparent:true,opacity:.14,depthWrite:false,
      side:THREE.DoubleSide,
    }),treadCount,
  )
  const pose=new THREE.Object3D()
  for(let i=0;i<treadCount;i++){
    const step=Math.floor(i/2),side=i%2===0?-1:1
    const x=-10.2+step*.23,z=side*.73+.14*Math.sin(x*.25)
    pose.position.set(x,ground(x,z)+.048,z)
    pose.rotation.set(-Math.PI/2,0,.09*Math.sin(x*.55))
    pose.scale.set(1,1,1)
    pose.updateMatrix()
    treads.setMatrixAt(i,pose.matrix)
  }
  treads.instanceMatrix.needsUpdate=true
  treads.frustumCulled=false
  treads.name='Instanced vehicle tread impressions (visual only)'
  root.add(treads)

  const soilMaterials=[
    new THREE.MeshStandardMaterial({color:0x76604a,roughness:1,vertexColors:true,flatShading:true,side:THREE.DoubleSide}),
    new THREE.MeshStandardMaterial({color:0x8d7158,roughness:1,vertexColors:true,flatShading:true,side:THREE.DoubleSide}),
    new THREE.MeshStandardMaterial({color:0x9a8065,roughness:1,vertexColors:true,flatShading:true,side:THREE.DoubleSide}),
  ]
  // Uneven, layered spoil heap rather than a mathematically smooth cone/dome.
  const moundGeometry=(()=>{
    const rings=11,segments=26
    const positions:number[]=[],colors:number[]=[],indices:number[]=[]
    const tone=new THREE.Color()
    for(let ring=0;ring<=rings;ring++){
      const r=ring/rings
      for(let j=0;j<=segments;j++){
        const angle=2*Math.PI*j/segments
        const irregular=1+.085*Math.sin(7*angle)+.045*Math.cos(11*angle)
        const radius=r*irregular
        const height=Math.pow(1-r,.72)*
          (.75+.08*Math.sin(5*angle+r*17)+.06*Math.cos(11*angle+r*9))
        positions.push(radius*Math.cos(angle),height,radius*Math.sin(angle)*.78)
        tone.set(0xa59379).multiplyScalar(.85+.13*Math.sin(angle*11+r*19))
        colors.push(tone.r,tone.g,tone.b)
        if(ring<rings&&j<segments){
          const a=ring*(segments+1)+j,b=a+segments+1
          indices.push(a,b,a+1,a+1,b,b+1)
        }
      }
    }
    const geometry=new THREE.BufferGeometry()
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3))
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    return geometry
  })()
  for(const [i,x,z,scale] of [
    [0,-10.5,-5.1,1.8],[1,-5.8,-5.6,1.3],[2,3.5,-6.3,1.6],
    [0,10.7,5.3,1.7],[1,4.8,8.9,1.9],[2,-7.7,7.5,1.45],
    [0,-13.8,17.5,4.1],[1,12.8,18.3,4.8],[2,.8,22,3.7],
  ] as const){
    const pile=new THREE.Mesh(moundGeometry,soilMaterials[i])
    pile.position.set(x,ground(x,z)-.02,z)
    pile.scale.set(scale,.57*scale,scale)
    pile.rotation.y=x*.19
    pile.castShadow=true;pile.receiveShadow=true
    root.add(pile)
  }

  // Aggregate scattered beyond the active delivery lane.
  const gravel=new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1,0),
    new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,flatShading:true}),
    420,
  )
  const rockColors=[0x473d34,0x796451,0xb09b80,0x594a39,0x968675]
  const rockColor=new THREE.Color()
  let placed=0
  for(let i=0;placed<gravel.count;i++){
    const x=-14+deterministicUnit(i*3)*29,z=-11+deterministicUnit(i*3+1)*23
    if(Math.abs(z)<2.4&&x>-11&&x<11)continue
    const size=.027+deterministicUnit(i*3+2)*.11
    pose.position.set(x,ground(x,z)+size*.19,z)
    pose.rotation.set(i*.7,i*.29,i*.13)
    pose.scale.set(size*1.5,size*.47,size)
    pose.updateMatrix()
    gravel.setMatrixAt(placed,pose.matrix)
    rockColor.set(rockColors[i%rockColors.length])
    gravel.setColorAt(placed,rockColor)
    placed++
  }
  gravel.instanceMatrix.needsUpdate=true
  if(gravel.instanceColor)gravel.instanceColor.needsUpdate=true
  gravel.frustumCulled=false
  gravel.name='Batched mixed site gravel'
  root.add(gravel)

  // Shallow wet earth beside the route, not a simulated change in friction.
  const wet=new THREE.MeshStandardMaterial({
    color:0x3c3530,roughness:.32,metalness:.07,
    transparent:true,opacity:.43,depthWrite:false,
  })
  for(const [x,z,w,d] of [[-3,-3.8,1.0,.4],[4.3,-3.1,.85,.3]]){
    const patch=new THREE.Mesh(new THREE.CircleGeometry(1,24),wet)
    patch.rotation.x=-Math.PI/2
    patch.scale.set(w,d,1)
    patch.position.set(x,ground(x,z)+.043,z)
    patch.receiveShadow=true
    root.add(patch)
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
  const wornYellow=new THREE.MeshStandardMaterial({
    color:0xf0b52d,map:proceduralConstructionPaintMap(),
    metalness:.21,roughness:.79,
  })
  box(machine,[2.2,.38,1.3],[0,.69,0],wornYellow)
  box(machine,[1.3,.12,1.22],[-.3,1.03,0],dark)
  box(machine,[1.02,1.1,.98],[-.62,1.51,0],wornYellow)
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
  beam(machine,shoulder,elbow,.15,wornYellow)
  beam(machine,v(.74,1.29,-.2),v(1.58,2.4,-.2),.05,steel)
  beam(machine,elbow,wrist,.112,wornYellow)
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
    color:0xe4af2b,map:proceduralConstructionPaintMap(),
    metalness:.3,roughness:.75,
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
  const weatheredConcrete=new THREE.MeshStandardMaterial({
    map:proceduralConcreteMap(),color:0xcac1b5,
    roughness:.95,metalness:.015,
  })
  const formwork=new THREE.MeshStandardMaterial({
    color:0x80624b,roughness:.92,metalness:0,
  })
  const building=new THREE.Group()
  building.position.set(3.2,ground(3.2,6.6),6.6)
  building.name='Incomplete concrete structure'
  root.add(building)
  for(let level=0;level<2;level++){
    const y=level*2.2
    for(const x of [-1.6,0,1.6])for(const z of [-.75,.75])
      box(building,[.21,2.2,.21],[x,y+1.1,z],weatheredConcrete)
    box(building,[3.8,.21,2.1],[0,y+2.13,0],weatheredConcrete)
  }
  for(let i=0;i<11;i++)
    beam(building,v(-1.7+i*.33,4.4,-.78),
      v(-1.7+i*.33,5.02,-.78),.016,steel)
  // Partially installed plywood formwork, access scaffolding and guard rails.
  for(const x of [-1.95,1.95]){
    for(const z of [-1.07,1.07]){
      beam(building,v(x,0,z),v(x,4.9,z),.025,steel)
      for(const y of [1.05,2.25,3.45,4.65])
        beam(building,v(x,y,z),v(-x,y,z),.019,steel)
    }
  }
  for(let j=0;j<7;j++)
    box(building,[.46,.87,.04],[-1.47+j*.49,2.8,-.84],formwork)
  for(const x of [-1.6,0,1.6]){
    for(const z of [-.75,.75]){
      const stain=box(building,[.04,.7,.015],[x,1.46,z+.118],rust)
      stain.castShadow=false
    }
  }
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

/** Site context stays beyond the active robot corridor. Nothing here is a
 * collision object, surveyed construction plan or synthetic sensor target. */
const addSiteDressing=(root:THREE.Group)=>{
  // Temporary chain-link perimeter with regularly spaced steel posts.
  const meshCanvas=document.createElement('canvas')
  meshCanvas.width=meshCanvas.height=128
  const ctx=meshCanvas.getContext('2d')
  if(!ctx)throw Error('Construction fence canvas unavailable')
  ctx.clearRect(0,0,128,128)
  ctx.strokeStyle='rgba(225,231,225,.68)'
  ctx.lineWidth=1.4
  for(let i=-128;i<256;i+=11){
    ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i+128,128);ctx.stroke()
    ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i-128,128);ctx.stroke()
  }
  const wire=new THREE.CanvasTexture(meshCanvas)
  wire.wrapS=wire.wrapT=THREE.RepeatWrapping
  wire.repeat.set(14,1)
  const fenceMat=new THREE.MeshBasicMaterial({
    map:wire,color:0x78847d,transparent:true,opacity:.58,
    alphaTest:.12,depthWrite:false,side:THREE.DoubleSide,
  })
  const fence=new THREE.Mesh(new THREE.PlaneGeometry(28,1.55),fenceMat)
  fence.position.set(0,1.04,10.7)
  fence.name='Temporary wire mesh site perimeter'
  root.add(fence)
  const postMat=new THREE.MeshStandardMaterial({
    color:0x8e938d,metalness:.56,roughness:.73,
  })
  const posts=new THREE.InstancedMesh(sharedBox,postMat,17)
  const pose=new THREE.Object3D()
  for(let i=0;i<17;i++){
    const x=-14+1.75*i
    pose.position.set(x,ground(x,10.7)+1.05,10.7)
    pose.scale.set(.052,2.1,.052)
    pose.rotation.set(0,0,0)
    pose.updateMatrix();posts.setMatrixAt(i,pose.matrix)
  }
  posts.instanceMatrix.needsUpdate=true;posts.frustumCulled=false
  posts.name='Instanced perimeter uprights'
  root.add(posts)
  for(const y of [.42,1.75])
    box(root,[28,.035,.036],[0,y,10.7],postMat)

  // A weather-beaten temporary site office, with corrugated metal sides.
  const cabin=new THREE.Group()
  cabin.position.set(-9.2,ground(-9.2,7.3),7.3)
  cabin.name='Temporary weathered site cabin'
  root.add(cabin)
  const cladding=new THREE.MeshStandardMaterial({
    color:0x607981,metalness:.23,roughness:.88,
  })
  const roof=new THREE.MeshStandardMaterial({
    color:0x484843,metalness:.14,roughness:.97,
  })
  box(cabin,[3.3,2.2,1.8],[0,1.17,0],cladding)
  box(cabin,[3.5,.14,2],[0,2.32,0],roof)
  box(cabin,[.74,1.66,.045],[.88,1.03,-.926],roof)
  box(cabin,[.55,.46,.056],[-.72,1.49,-.932],glass)
  const ribs=new THREE.InstancedMesh(sharedBox,postMat,22)
  for(let i=0;i<22;i++){
    pose.position.set(-1.59+i*.151,1.2,-.925)
    pose.scale.set(.026,2.05,.025)
    pose.updateMatrix();ribs.setMatrixAt(i,pose.matrix)
  }
  ribs.instanceMatrix.needsUpdate=true;ribs.frustumCulled=false
  ribs.name='Weathered corrugated wall ribs'
  cabin.add(ribs)
  addConstructionContactShadow(cabin,3.7,2.15,.047)

  // Lumber and reinforcing steel, stored off the travelling lane.
  const timber=new THREE.MeshStandardMaterial({
    color:0x946e4b,metalness:0,roughness:1,
  })
  const timberStack=new THREE.Group()
  timberStack.position.set(-7.8,ground(-7.8,-4.2),-4.2)
  timberStack.name='Stacked formwork and cut timber'
  root.add(timberStack)
  const planks=new THREE.InstancedMesh(sharedBox,timber,25)
  let plankIndex=0
  for(let layer=0;layer<5;layer++)
    for(let plank=0;plank<5;plank++){
      pose.position.set(0,.09+layer*.09,-.39+plank*.195)
      pose.rotation.set(0,0,0)
      pose.scale.set(2.1,.065,.15)
      pose.updateMatrix();planks.setMatrixAt(plankIndex++,pose.matrix)
    }
  planks.castShadow=true;planks.receiveShadow=true
  planks.instanceMatrix.needsUpdate=true;planks.frustumCulled=false
  planks.name='Instanced stacked timber'
  timberStack.add(planks)
  addConstructionContactShadow(timberStack,2.4,1.5,.02)

  const rebar=new THREE.Group()
  rebar.position.set(6.2,ground(6.2,8.0),8.0)
  rebar.name='Cut reinforcing bars staged for placement'
  root.add(rebar)
  const rods=new THREE.InstancedMesh(
    new THREE.CylinderGeometry(.022,.022,2.3,6),rust,36,
  )
  let index=0
  for(let layer=0;layer<4;layer++)for(let j=0;j<9;j++){
    pose.position.set(0,.09+layer*.058,-.38+j*.095)
    pose.rotation.set(0,0,Math.PI/2)
    pose.scale.set(1,1,1)
    pose.updateMatrix();rods.setMatrixAt(index++,pose.matrix)
  }
  rods.instanceMatrix.needsUpdate=true;rods.frustumCulled=false
  rebar.add(rods)
  for(const x of [-.75,.75])
    box(rebar,[.18,.09,1.2],[x,.04,0],timber)

  // Used site barrels and plastic barriers; reusable geometry and instances.
  const drums=new THREE.InstancedMesh(
    new THREE.CylinderGeometry(.22,.22,.62,12),
    new THREE.MeshStandardMaterial({color:0xa07e48,roughness:.89,metalness:.14}),
    7,
  )
  for(let i=0;i<7;i++){
    const x=-11.5+i*.71,z=9.1+.14*Math.sin(i)
    pose.position.set(x,ground(x,z)+.31,z)
    pose.rotation.set(.04*Math.sin(i),i*.31,.03*Math.cos(i))
    pose.scale.set(1,1,1);pose.updateMatrix()
    drums.setMatrixAt(i,pose.matrix)
  }
  drums.instanceMatrix.needsUpdate=true;drums.frustumCulled=false
  drums.name='Used construction-site barrels'
  root.add(drums)

  // Brown dry grasses and hardy weeds at the perimeter, never in the active
  // route. A single instanced mesh breaks up the infinite-bare-earth horizon.
  const weeds=new THREE.InstancedMesh(
    new THREE.ConeGeometry(.065,.28,3),
    new THREE.MeshStandardMaterial({
      color:0xffffff,roughness:1,flatShading:true,side:THREE.DoubleSide,
    }),
    340,
  )
  const plantColors=[0x847e55,0x697052,0x77754b,0x998d60,0x586850]
  const tint=new THREE.Color()
  for(let i=0;i<weeds.count;i++){
    const x=-19+deterministicUnit(11*i)*38
    const z=12+deterministicUnit(11*i+1)*12
    const h=.14+deterministicUnit(11*i+2)*.34
    pose.position.set(x,ground(x,z)+h*.48,z)
    pose.rotation.set(0,deterministicUnit(11*i+3)*Math.PI,0)
    pose.scale.set(.5+deterministicUnit(11*i+4),h/.28,
      .5+deterministicUnit(11*i+5))
    pose.updateMatrix();weeds.setMatrixAt(i,pose.matrix)
    tint.set(plantColors[i%plantColors.length])
    weeds.setColorAt(i,tint)
  }
  weeds.instanceMatrix.needsUpdate=true
  if(weeds.instanceColor)weeds.instanceColor.needsUpdate=true
  weeds.frustumCulled=false
  weeds.name='Dry boundary grasses (render only)'
  root.add(weeds)
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
  addSiteDressing(root)
  return root
}
