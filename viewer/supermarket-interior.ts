import * as THREE from 'three'
import { supermarketObstacles } from '../src/geometry.ts'

/**
 * Visual-only supermarket interior. Store geometry/physics/sensor meshes remain
 * sourced exclusively from src/geometry.ts. Decorative products and the room
 * do not modify Modelica, collision or LiDAR source geometry.
 *
 * Bright packaged goods, suspended linear luminaires, acoustic tile ceiling,
 * brushed aluminum shelves and a lightly reflective terrazzo floor.
 */
type ProductStyle = Readonly<{label:string;secondary:string;color:number;accent:number;kind:'box'|'can'|'bottle'}>
const products:readonly ProductStyle[]=[
  {label:'HARVEST',secondary:'CRUNCH',color:0xeaba49,accent:0x6a9c54,kind:'box'},
  {label:'FRESH',secondary:'PANTRY',color:0xd95b45,accent:0xf5cf62,kind:'box'},
  {label:'COCOA',secondary:'BLEND',color:0x76564f,accent:0xe0b67b,kind:'box'},
  {label:'CITRUS',secondary:'JUICE',color:0xf0a13a,accent:0xf8dd91,kind:'box'},
  {label:'ORGANIC',secondary:'GRAINS',color:0x659379,accent:0xe4eac8,kind:'box'},
  {label:'VITA',secondary:'DRINK',color:0x68aab5,accent:0xe6f0e5,kind:'bottle'},
  {label:'SOUP',secondary:'CLASSIC',color:0xc95851,accent:0xf3ddbf,kind:'can'},
  {label:'SPARK',secondary:'TONIC',color:0x356d9f,accent:0xe4d1a2,kind:'can'},
]
const baseMaterial=(color:number,roughness=.58,metalness=.04)=>
  new THREE.MeshStandardMaterial({color,roughness,metalness})
const shopWhite=baseMaterial(0xdce6df,.44,.2)
const steel=baseMaterial(0x5e7681,.28,.7)
const trim=baseMaterial(0xbecac8,.35,.37)
const billboard=baseMaterial(0x3c6967,.4,.15)

const cartonTexture=(style:ProductStyle):THREE.CanvasTexture=>{
  const canvas=document.createElement('canvas')
  canvas.width=256;canvas.height=256
  const ctx=canvas.getContext('2d')
  if(!ctx)throw Error('Cannot draw supermarket product graphics')
  const color='#'+style.color.toString(16).padStart(6,'0')
  const accent='#'+style.accent.toString(16).padStart(6,'0')
  ctx.fillStyle=color;ctx.fillRect(0,0,256,256)
  ctx.fillStyle=accent;ctx.fillRect(0,36,256,150)
  ctx.fillStyle='rgba(255,255,255,.24)'
  ctx.fillRect(9,41,238,5);ctx.fillRect(9,172,238,6)
  ctx.fillStyle='rgba(255,255,255,.94)'
  ctx.beginPath();ctx.arc(128,102,37,0,Math.PI*2);ctx.fill()
  ctx.fillStyle=color;ctx.beginPath();ctx.arc(128,102,22,0,Math.PI*2);ctx.fill()
  ctx.fillStyle='#fff'
  ctx.textAlign='center';ctx.textBaseline='middle'
  ctx.font='800 30px system-ui,sans-serif';ctx.fillText(style.label,128,20,240)
  ctx.font='bold 22px system-ui,sans-serif';ctx.fillText(style.secondary,128,219,240)
  ctx.fillStyle='#fff';ctx.fillRect(13,240,230,8)
  const texture=new THREE.CanvasTexture(canvas)
  texture.colorSpace=THREE.SRGBColorSpace
  texture.anisotropy=2
  return texture
}

/** One instanced geometry and one draw call per merchandise SKU. */
const makeStock=(scene:THREE.Group):number=>{
  const distributions:THREE.Matrix4[][]=products.map(()=>[])
  const dummy=new THREE.Object3D()
  for(const obstacle of supermarketObstacles){
    if(obstacle.kind!=='shelf')continue
    const colorOffset=Math.round(obstacle.x*13+Math.abs(obstacle.z)*5)
    for(let tier=0;tier<5;tier++){
      const y=.31+tier*.39
      for(const side of [-1,1]){
        for(let column=0;column<12;column++){
          const variant=(column+3*tier+colorOffset+(side===1?2:0))%products.length
          const style=products[variant]!
          dummy.position.set(
            obstacle.x-obstacle.halfX+.155+column*.205,
            y+(.13+(column%3)*.012),
            obstacle.z+side*(obstacle.halfZ-.18),
          )
          const variation=.91+((column+tier)%4)*.047
          dummy.scale.set(variation,style.kind==='bottle'?.9:1,variation)
          dummy.rotation.set(0,side===1?Math.PI:0,0)
          dummy.updateMatrix()
          distributions[variant]!.push(dummy.matrix.clone())
        }
      }
    }
  }
  for(const [index,matrices] of distributions.entries()){
    const product=products[index]!
    if(!matrices?.length)continue
    const geometry=product.kind==='can'
      ?new THREE.CylinderGeometry(.075,.075,.27,10,1)
      :product.kind==='bottle'
        ?new THREE.CylinderGeometry(.048,.071,.29,8,1)
        :new THREE.BoxGeometry(.17,.29,.235)
    const material=new THREE.MeshStandardMaterial({
      map:cartonTexture(product),roughness:product.kind==='box'?.69:.31,
      metalness:product.kind==='can'?.36:.06,
    })
    const mesh=new THREE.InstancedMesh(geometry,material,matrices.length)
    mesh.name='Instanced merchandise — '+product.label
    mesh.frustumCulled=false
    for(let i=0;i<matrices.length;i++)mesh.setMatrixAt(i,matrices[i]!)
    mesh.instanceMatrix.needsUpdate=true
    // No product shadows: detailed stock is decorative and heavily instanced.
    mesh.castShadow=false
    mesh.receiveShadow=false
    scene.add(mesh)
  }
  return distributions.reduce((count,list)=>count+list.length,0)
}
const tileTexture=():THREE.CanvasTexture=>{
  const canvas=document.createElement('canvas')
  canvas.width=256;canvas.height=256
  const ctx=canvas.getContext('2d')
  if(!ctx)throw Error('Canvas 2D texture unavailable')
  ctx.fillStyle='#bdc8c3';ctx.fillRect(0,0,256,256)
  // Baked terrazzo flecks and grout: one small repeating PBR texture.
  let seed=4711
  const random=()=>{
    seed=(Math.imul(seed,1664525)+1013904223)>>>0
    return seed/4294967296
  }
  for(let i=0;i<1500;i++){
    const shade=170+Math.floor(random()*55)
    ctx.fillStyle=`rgba(${shade},${shade+Math.min(8,255-shade)},${shade},.10)`
    ctx.fillRect(random()*256,random()*256,1+random()*2,1+random()*2)
  }
  ctx.strokeStyle='rgba(99,121,123,.28)'
  ctx.lineWidth=2
  for(let p=0;p<=256;p+=64){
    ctx.beginPath();ctx.moveTo(p,0);ctx.lineTo(p,256);ctx.stroke()
    ctx.beginPath();ctx.moveTo(0,p);ctx.lineTo(256,p);ctx.stroke()
  }
  const texture=new THREE.CanvasTexture(canvas)
  texture.colorSpace=THREE.SRGBColorSpace
  texture.wrapS=THREE.RepeatWrapping
  texture.wrapT=THREE.RepeatWrapping
  texture.repeat.set(12,8)
  texture.anisotropy=4
  return texture
}
const signTexture=(text:string):THREE.CanvasTexture=>{
  const canvas=document.createElement('canvas')
  canvas.width=384;canvas.height=128
  const ctx=canvas.getContext('2d')
  if(!ctx)throw Error('Canvas 2D texture unavailable')
  ctx.fillStyle='#2c6b67';ctx.fillRect(0,0,384,128)
  ctx.fillStyle='#8be6cc';ctx.fillRect(0,112,384,16)
  ctx.fillStyle='#f7faf0';ctx.font='bold 54px system-ui,sans-serif'
  ctx.textAlign='center';ctx.textBaseline='middle'
  ctx.fillText(text,192,59,360)
  const t=new THREE.CanvasTexture(canvas)
  t.colorSpace=THREE.SRGBColorSpace
  return t
}
type StaticBatch = { material:THREE.Material; shadows:boolean; transforms:THREE.Matrix4[] }
/** Scoped to one scene instance; never share pending geometry between scenes. */
const createStaticBoxBatcher=()=>{
  const pending=new Map<THREE.Group,Map<THREE.Material,StaticBatch>>()
  const addBox=(
    group:THREE.Group,_geometry:THREE.BoxGeometry,
    w:number,h:number,d:number,x:number,y:number,z:number,
    material:THREE.Material,shadows=false,
  ):void=>{
    let byMaterial=pending.get(group)
    if(!byMaterial){byMaterial=new Map();pending.set(group,byMaterial)}
    let batch=byMaterial.get(material)
    if(!batch){batch={material,shadows,transforms:[]};byMaterial.set(material,batch)}
    batch.transforms.push(new THREE.Matrix4().makeScale(w,h,d).setPosition(x,y,z))
  }
  const flushStaticBoxes=(unit:THREE.BoxGeometry)=>{
    for(const [group,byMaterial] of pending){
      for(const {material,shadows,transforms} of byMaterial.values()){
        const mesh=new THREE.InstancedMesh(unit,material,transforms.length)
        mesh.name='Instanced store architecture'
        transforms.forEach((matrix,index)=>mesh.setMatrixAt(index,matrix))
        mesh.instanceMatrix.needsUpdate=true
        mesh.castShadow=shadows
        mesh.receiveShadow=shadows
        mesh.computeBoundingSphere()
        group.add(mesh)
      }
    }
    pending.clear()
  }
  return {addBox,flushStaticBoxes}
}
/**
 * Tiny synthetic reflection panorama. Three.js prefilters this 128x64 texture
 * once, substantially cheaper than PMREM.fromScene (six camera renders).
 * Bright strips are environment highlights, not mirrored physics geometry.
 */
const createStudioReflection=():THREE.Texture=>{
  const canvas=document.createElement('canvas')
  canvas.width=128
  canvas.height=64
  const ctx=canvas.getContext('2d')
  if(!ctx)throw Error('Canvas environment unavailable')
  const gradient=ctx.createLinearGradient(0,0,0,64)
  gradient.addColorStop(0,'#eef7f6')
  gradient.addColorStop(.36,'#9bb7b8')
  gradient.addColorStop(.68,'#718b90')
  gradient.addColorStop(1,'#bac9c3')
  ctx.fillStyle=gradient
  ctx.fillRect(0,0,128,64)
  ctx.fillStyle='#f8ffff'
  for(const x of [12,42,76,107])ctx.fillRect(x,7,7,20)
  const texture=new THREE.CanvasTexture(canvas)
  texture.mapping=THREE.EquirectangularReflectionMapping
  texture.colorSpace=THREE.SRGBColorSpace
  return texture
}

export type SupermarketInterior=Readonly<{
  decorativeProductCount:number
  overheadLights:number
  setCeilingVisible:(visible:boolean)=>void
  setVisualQuality:(quality:'high'|'balanced'|'performance')=>void
  dispose:()=>void
}>

export const createSupermarketInterior=(
  scene:THREE.Scene,renderer:THREE.WebGLRenderer,
):SupermarketInterior=>{
  const interior=new THREE.Group()
  interior.name='Visual supermarket architecture (non-collidable)'
  scene.add(interior)

  // Reflective tiles, clearcoat and environment strip highlights. No SSR,
  // per-frame planar reflector or mirrored framebuffer is used.
  const room=new THREE.Group()
  interior.add(room)
  const {addBox,flushStaticBoxes}=createStaticBoxBatcher()
  const unit=new THREE.BoxGeometry(1,1,1)
  const floor=new THREE.Mesh(
    new THREE.PlaneGeometry(20,15),
    new THREE.MeshPhysicalMaterial({
      map:tileTexture(),roughness:.24,metalness:.10,
      clearcoat:.76,clearcoatRoughness:.14,envMapIntensity:1.15,
    }),
  )
  floor.name='PBR polished terrazzo tile floor'
  floor.rotation.x=-Math.PI/2
  floor.position.set(4.2,-.015,0)
  floor.receiveShadow=true
  room.add(floor)

  const wall=baseMaterial(0xc2d0cf,.94,.015)
  const lowerWall=baseMaterial(0x6a827e,.8,.04)
  const walls:[
    number,number,number,number,number,number
  ][]=[
    [20,4.7,.09,4.2,2.35,-7.45],
    [20,4.7,.09,4.2,2.35,7.45],
    [.09,4.7,15,-5.8,2.35,0],
    [.09,4.7,15,14.2,2.35,0],
  ]
  walls.forEach(([w,h,d,x,y,z],index)=>{
    // The camera-side wall is deliberately a cutaway in perspective views.
    if(index===1||index===3)return
    addBox(room,unit,w,h,d,x,y,z,wall)
    addBox(room,unit,w,.24,d,x,.12,z,lowerWall)
  })
  const ceiling=new THREE.Group()
  ceiling.name='Cutaway acoustic ceiling and suspended linear LEDs'
  interior.add(ceiling)
  const ceilMaterial=new THREE.MeshStandardMaterial({
    color:0xd9e2dc,roughness:.98,side:THREE.FrontSide,
  })
  const ceilingPlane=new THREE.Mesh(new THREE.PlaneGeometry(20,15),ceilMaterial)
  // Normal points down; upper cutaway viewer sees the room through the back face.
  ceilingPlane.rotation.x=Math.PI/2
  ceilingPlane.position.set(4.2,4.72,0)
  ceilingPlane.castShadow=false
  ceiling.add(ceilingPlane)
  const extrusion=baseMaterial(0x8fa3a5,.48,.58)
  for(let x=-5;x<=14;x+=1.1){
    addBox(ceiling,unit,.014,.025,15,x,4.698,0,extrusion)
  }
  for(let z=-7.5;z<=7.5;z+=1.1){
    addBox(ceiling,unit,20,.025,.014,4.2,4.698,z,extrusion)
  }
  const fixture=baseMaterial(0xcdd8d8,.27,.64)
  const led=new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide})
  let lamps=0
  for(const x of [-3.5,-1.0,1.5,4.0,6.5,9.0,11.5]){
    for(const z of [-4.9,-2.1,.65,3.15,5.6]){
      addBox(ceiling,unit,1.74,.067,.115,x,4.55,z,fixture)
      addBox(ceiling,unit,1.65,.012,.083,x,4.508,z,led)
      lamps++
    }
  }

  // Ambient + one clean directional shadow map, plus non-shadow fill spots.
  const ambient=new THREE.HemisphereLight(0xf6ffff,0x87908e,2.55)
  interior.add(ambient)
  const key=new THREE.DirectionalLight(0xfff5e9,2.5)
  key.position.set(3.8,9,5)
  key.castShadow=true
  key.shadow.mapSize.set(1024,1024)
  key.shadow.camera.left=-11;key.shadow.camera.right=11
  key.shadow.camera.top=11;key.shadow.camera.bottom=-11
  key.shadow.bias=-.00035
  key.shadow.normalBias=.018
  interior.add(key)
  const softLight=new THREE.PointLight(0xe9f9fc,28,21,2)
  softLight.position.set(7,4.15,-2.4)
  interior.add(softLight)
  const softWarm=new THREE.PointLight(0xffedce,19,18,2)
  softWarm.position.set(.6,4.15,2.7)
  interior.add(softWarm)

  const rack=new THREE.Group()
  rack.name='PBR shelving and merchandise'
  interior.add(rack)
  const border=baseMaterial(0xe5efee,.51,.16)
  const band=baseMaterial(0x2c706f,.42,.23)
  for(const o of supermarketObstacles){
    const root=new THREE.Group()
    root.position.set(o.x,0,o.z)
    root.name='Fixture '+o.id
    rack.add(root)
    if(o.kind==='obstruction'){
      // No extra colliders: this uses the obstacle's actual AABB.
      addBox(root,unit,o.halfX*2,o.height,o.halfZ*2,0,o.height/2,0,
        new THREE.MeshPhysicalMaterial({
          color:0xb7c6c3,roughness:.37,metalness:.23,clearcoat:.22,
        }),true)
      for(let level=0;level<3;level++){
        addBox(root,unit,o.halfX*2+.035,.048,o.halfZ*2+.04,
          0,.35+level*.49,0,steel)
      }
    }else{
      const width=o.halfX*2
      const depth=o.halfZ*2
      for(const z of [-o.halfZ,o.halfZ])
        for(const x of [-o.halfX,o.halfX])
          addBox(root,unit,.047,o.height,.047,x,o.height/2,z,steel)
      for(let level=0;level<5;level++){
        const y=.27+level*.39
        addBox(root,unit,width,.055,depth,0,y,0,shopWhite)
        for(const side of [-1,1]){
          addBox(root,unit,width,.072,.023,0,y+.015,side*(o.halfZ-.015),border)
          addBox(root,unit,width,.021,.028,0,y-.019,side*(o.halfZ+.002),band)
        }
      }
      addBox(root,unit,width+.04,.077,depth+.04,0,2.07,0,trim)
      // Endcaps on each physical shelf; render-only panels.
      for(const x of [-o.halfX,o.halfX]){
        addBox(root,unit,.025,1.76,depth-.03,x,1.12,0,billboard)
      }
    }
  }
  const decorativeProductCount=makeStock(rack)

  // Overhead category boards and a store graphic are intentionally
  // lightweight textured planes, not signage assets fetched at runtime.
  for(const [text,x,z] of [
    ['GROCERY',2.2,-2.9],
    ['EVERYDAY',5.4,-2.9],
    ['PANTRY',2.2,3.0],
    ['ESSENTIALS',5.4,3.0],
  ] as const){
    const panel=new THREE.Mesh(
      new THREE.PlaneGeometry(1.8,.6),
      new THREE.MeshBasicMaterial({map:signTexture(text),side:THREE.DoubleSide}),
    )
    panel.position.set(x,2.52,z)
    panel.rotation.y=z>0?0:Math.PI
    rack.add(panel)
  }
  flushStaticBoxes(unit)
  const environment=createStudioReflection()
  scene.environment=environment
  scene.background=new THREE.Color(0x9eb3b5)
  scene.fog=new THREE.FogExp2(0x9eb3b5,.012)

  const setVisualQuality=(quality:'high'|'balanced'|'performance')=>{
    // Lower GPU fragment work; preserve geometry and all simulation results.
    const low=quality==='performance'
    scene.environment=low?null:environment
    softLight.visible=!low
    softWarm.visible=!low
    // One shadow-casting key, no dynamic reflection captures.
    key.castShadow=!low
    const material=floor.material as THREE.MeshPhysicalMaterial
    material.clearcoat=low?0:.76
    material.roughness=low?.47:.24
    material.metalness=low?.025:.10
    material.needsUpdate=true
  }
  return {
    decorativeProductCount,overheadLights:lamps,
    setVisualQuality,
    setCeilingVisible:visible=>{ceiling.visible=visible},
    dispose:()=>{
      scene.remove(interior)
      interior.traverse(object=>{
        if(object instanceof THREE.Mesh){
          object.geometry.dispose()
          if(Array.isArray(object.material))
            object.material.forEach(m=>m.dispose())
          else object.material.dispose()
        }
      })
      environment.dispose()
    },
  }
}
