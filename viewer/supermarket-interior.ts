import * as THREE from 'three'
import { supermarketObstacles } from '../src/geometry.ts'
import {createSupermarketStock} from './supermarket-products.ts'
import {createSupermarketDecor} from './supermarket-decor.ts'
import {createWallSeamShading} from './contact-shading.ts'
import {ceilingShadowBudget,type GraphicsEffects} from './graphics-settings.ts'
import {bakeFloorOcclusion} from './static-floor-lighting.ts'
import {isSoftwareRenderer} from './renderer-capabilities.ts'
import terrazzoDiffuse from '../assets/materials/terrazzo_tiles_diff_1k.jpg?url'
import terrazzoRough from '../assets/materials/terrazzo_tiles_rough_1k.jpg?url'
import terrazzoNormal from '../assets/materials/terrazzo_tiles_nor_gl_1k.jpg?url'

/**
 * Visual-only supermarket interior. Store geometry/physics/sensor meshes remain
 * sourced exclusively from src/geometry.ts. Decorative products and the room
 * do not modify Modelica, collision or LiDAR source geometry.
 *
 * Bright packaged goods, suspended linear luminaires, acoustic tile ceiling,
 * brushed aluminum shelves and a lightly reflective terrazzo floor.
 */
const baseMaterial=(color:number,roughness=.58,metalness=.04)=>
  new THREE.MeshStandardMaterial({color,roughness,metalness})

/** Tiny deterministic brushed-steel normals/roughness: no external textures,
 * no new mesh geometry, reused by all shelf/fixture material instances. */
const createBrushedSteelMaps=()=>{
  const normalCanvas=document.createElement('canvas')
  const roughCanvas=document.createElement('canvas')
  normalCanvas.width=roughCanvas.width=64
  normalCanvas.height=roughCanvas.height=64
  const normalCtx=normalCanvas.getContext('2d')
  const roughCtx=roughCanvas.getContext('2d')
  if(!normalCtx||!roughCtx)throw Error('Brushed steel texture canvas unavailable')
  const normals=normalCtx.createImageData(64,64)
  const roughness=roughCtx.createImageData(64,64)
  for(let y=0;y<64;y++){
    const streak=Math.sin(y*.38)*.56+Math.sin(y*1.39)*.27
    for(let x=0;x<64;x++){
      const variation=Math.sin(x*1.97+y*.71)*.17
      const i=(y*64+x)*4
      normals.data.set([128,Math.round(128+14*(streak+variation)),252,255],i)
      const shade=Math.round(210+24*streak+11*variation)
      roughness.data.set([shade,shade,shade,255],i)
    }
  }
  normalCtx.putImageData(normals,0,0)
  roughCtx.putImageData(roughness,0,0)
  const normal=new THREE.CanvasTexture(normalCanvas)
  const rough=new THREE.CanvasTexture(roughCanvas)
  for(const map of [normal,rough]){
    map.wrapS=THREE.RepeatWrapping
    map.wrapT=THREE.RepeatWrapping
    map.repeat.set(2,2)
  }
  return {normal,rough,dispose:()=>{normal.dispose();rough.dispose()}}
}
/** CC0 photo-scanned material by Amal Kumar, Poly Haven: terrazzo_tiles.
 * All three 1K maps are vendored; no runtime texture CDN/network dependency. */
const makeFloorMaps=(renderer:THREE.WebGLRenderer)=>{
  const loader=new THREE.TextureLoader()
  const paths=[terrazzoDiffuse,terrazzoRough,terrazzoNormal] as const
  const maps=paths.map((path,index)=>{
    const texture=loader.load(path)
    texture.wrapS=THREE.RepeatWrapping
    texture.wrapT=THREE.RepeatWrapping
    texture.repeat.set(10,7.5)
    texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy())
    if(index===0)texture.colorSpace=THREE.SRGBColorSpace
    return texture
  })
  return {
    diffuse:maps[0]!,
    roughness:maps[1]!,
    normal:maps[2]!,
    dispose:()=>maps.forEach(map=>map.dispose()),
  }
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
 * A tiny procedural panorama of ceiling panels and shelving highlights.
 * Three.js PMREM-prefilters this equirectangular texture once, rather than
 * rendering six cube cameras each frame. Bright strips approximate the room's
 * specular environment; they are not true mirrored scene reflections.
 */
const createStudioReflection=():THREE.Texture=>{
  const canvas=document.createElement('canvas')
  canvas.width=256
  canvas.height=128
  const ctx=canvas.getContext('2d')
  if(!ctx)throw Error('Canvas environment unavailable')
  const gradient=ctx.createLinearGradient(0,0,0,128)
  gradient.addColorStop(0,'#f8f2e6')
  gradient.addColorStop(.34,'#c3d0d0')
  gradient.addColorStop(.59,'#73878b')
  gradient.addColorStop(.83,'#52646c')
  gradient.addColorStop(1,'#8d9b98')
  ctx.fillStyle=gradient
  ctx.fillRect(0,0,256,128)
  // Large ceiling panels and linear fluorescent strips make the physically
  // plausible specular highlights visible even on brushed, rough materials.
  for(const x of [10,45,79,115,150,190,225]){
    ctx.fillStyle='#fffefa'
    ctx.fillRect(x,10,12,29)
    ctx.fillStyle='#fcead0'
    ctx.fillRect(x+1,40,10,5)
  }
  ctx.fillStyle='#364953'
  for(const x of [20,70,126,180,238])ctx.fillRect(x,79,5,25)
  const texture=new THREE.CanvasTexture(canvas)
  texture.mapping=THREE.EquirectangularReflectionMapping
  texture.colorSpace=THREE.SRGBColorSpace
  return texture
}

export type SupermarketInterior=Readonly<{
  decorativeProductCount:number
  overheadLights:number
  setCeilingVisible:(visible:boolean)=>void
  setVisualQuality:(quality:'high'|'balanced'|'performance',effects:GraphicsEffects)=>void
  whenExtraLightingReady:()=>Promise<void>
  dispose:()=>void
}>

export const createSupermarketInterior=(
  scene:THREE.Scene,renderer:THREE.WebGLRenderer,
):SupermarketInterior=>{
  const softwareRenderer=isSoftwareRenderer(renderer)
  const interior=new THREE.Group()
  interior.name='Visual supermarket architecture (non-collidable)'
  scene.add(interior)

  // Reflective tiles, clearcoat and environment strip highlights. No SSR,
  // per-frame planar reflector or mirrored framebuffer is used.
  const room=new THREE.Group()
  interior.add(room)
  const {addBox,flushStaticBoxes}=createStaticBoxBatcher()
  const floorMaps=makeFloorMaps(renderer)
  const unit=new THREE.BoxGeometry(1,1,1)
  // Static indirect-light occlusion is computed once from fixed footprints.
  // This costs one small AO texture upload, not an SSAO render every frame.
  const staticOcclusion=new THREE.CanvasTexture(
    bakeFloorOcclusion(supermarketObstacles))
  const shopWhite=baseMaterial(0xdce6df,.38,.18)
  const brushedSteel=createBrushedSteelMaps()
  const steel=baseMaterial(0x6c7f87,.33,.79)
  const trim=baseMaterial(0xbecac8,.38,.45)
  for(const metal of [steel,trim]){
    metal.normalMap=brushedSteel.normal
    metal.normalScale.set(.22,.22)
    metal.roughnessMap=brushedSteel.rough
  }
  const billboard=baseMaterial(0x3c6967,.4,.15)
  const floorHigh=new THREE.MeshPhysicalMaterial({
    map:floorMaps.diffuse,roughnessMap:floorMaps.roughness,
    normalMap:floorMaps.normal,normalScale:new THREE.Vector2(.49,.49),
    aoMap:staticOcclusion,aoMapIntensity:1.35,
    color:0xe8e9e4,roughness:.32,metalness:.02,
    clearcoat:.76,clearcoatRoughness:.12,envMapIntensity:1.4,
  })
  const floorBalanced=new THREE.MeshStandardMaterial({
    map:floorMaps.diffuse,normalMap:floorMaps.normal,
    roughnessMap:floorMaps.roughness,
    aoMap:staticOcclusion,aoMapIntensity:.95,
    normalScale:new THREE.Vector2(.32,.32),color:0xe8e9e4,
    roughness:.43,metalness:.015,envMapIntensity:.9,
  })
  const floorPerformance=new THREE.MeshBasicMaterial({
    map:floorMaps.diffuse,color:0xdadfd9,
  })
  const floor=new THREE.Mesh<THREE.PlaneGeometry,THREE.Material>(
    new THREE.PlaneGeometry(20,15),floorHigh,
  )
  // Three.js uses the secondary UV channel for the baked aoMap.
  floor.geometry.setAttribute('uv2',floor.geometry.getAttribute('uv').clone())
  floor.name='PBR polished terrazzo tile floor'
  floor.rotation.x=-Math.PI/2
  floor.position.set(4.2,-.015,0)
  floor.receiveShadow=true
  room.add(floor)

  // Soft baked contact shadow: one small transparent atlas, five instances,
  // no additional shadow-map renders or collision/SLAM geometry.
  const shadowCanvas=document.createElement('canvas')
  shadowCanvas.width=64;shadowCanvas.height=64
  const shadowCtx=shadowCanvas.getContext('2d')
  if(!shadowCtx)throw Error('Contact shadow canvas unavailable')
  const gradient=shadowCtx.createRadialGradient(32,32,8,32,32,32)
  gradient.addColorStop(0,'rgba(17,24,24,.80)')
  gradient.addColorStop(.62,'rgba(17,24,24,.38)')
  gradient.addColorStop(1,'rgba(17,24,24,0)')
  shadowCtx.fillStyle=gradient
  shadowCtx.fillRect(0,0,64,64)
  const shadowTexture=new THREE.CanvasTexture(shadowCanvas)
  const shadowMaterial=new THREE.MeshBasicMaterial({
    map:shadowTexture,transparent:true,depthWrite:false,
    opacity:.85,polygonOffset:true,polygonOffsetFactor:-1,
  })
  const shadows=new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1,1),shadowMaterial,supermarketObstacles.length,
  )
  const shadowPose=new THREE.Object3D()
  for(const [index,obstacle] of supermarketObstacles.entries()){
    shadowPose.position.set(obstacle.x,.006,obstacle.z)
    shadowPose.rotation.set(-Math.PI/2,0,0)
    shadowPose.scale.set(obstacle.halfX*2+.55,obstacle.halfZ*2+.55,1)
    shadowPose.updateMatrix()
    shadows.setMatrixAt(index,shadowPose.matrix)
  }
  shadows.instanceMatrix.needsUpdate=true
  shadows.name='Visual-only fixture contact shading'
  room.add(shadows)
  const seams=createWallSeamShading()
  room.add(seams.root)

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
    // Keep only the near-side wall out of view for orbiting above the room.
    if(index===1)return
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
  const fixture=baseMaterial(0xcdd8d8,.34,.64)
  fixture.normalMap=brushedSteel.normal
  fixture.normalScale.set(.16,.16)
  fixture.roughnessMap=brushedSteel.rough
  // Every strip is a physically emissive material; 4 clustered point emitters
  // approximate the shared illumination field without 35 extra shadow maps.
  const led=new THREE.MeshStandardMaterial({
    color:0xfffbf1,emissive:0xfff0d2,emissiveIntensity:2.4,
    roughness:.44,side:THREE.DoubleSide,
  })
  const xFixtures=[-3.5,-1.0,1.5,4.0,6.5,9.0,11.5]
  const zFixtures=[-4.9,-2.1,.65,3.15,5.6]
  let lamps=0
  for(const x of xFixtures){
    for(const z of zFixtures){
      addBox(ceiling,unit,1.74,.067,.115,x,4.55,z,fixture)
      addBox(ceiling,unit,1.65,.012,.083,x,4.508,z,led)
      lamps++
    }
  }
  // Soft additive emission halos deliberately replace a full-screen bloom
  // chain on Balanced: one batched draw, independent of screen resolution.
  const glareCanvas=document.createElement('canvas')
  glareCanvas.width=128;glareCanvas.height=64
  const glareCtx=glareCanvas.getContext('2d')
  if(!glareCtx)throw Error('Lamp glow canvas unavailable')
  const glow=glareCtx.createRadialGradient(64,32,3,64,32,31)
  glow.addColorStop(0,'rgba(255,250,235,.75)')
  glow.addColorStop(.38,'rgba(255,244,221,.26)')
  glow.addColorStop(1,'rgba(255,244,221,0)')
  glareCtx.fillStyle=glow
  glareCtx.fillRect(0,0,128,64)
  const glareTexture=new THREE.CanvasTexture(glareCanvas)
  const glareMaterial=new THREE.MeshBasicMaterial({
    map:glareTexture,transparent:true,depthWrite:false,
    blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
    color:0xffedd2,toneMapped:false,
  })
  const glareGeometry=new THREE.PlaneGeometry(1,1)
  const glare=new THREE.InstancedMesh(glareGeometry,glareMaterial,lamps)
  const glareTransform=new THREE.Object3D()
  let glareIndex=0
  for(const x of xFixtures){
    for(const z of zFixtures){
      glareTransform.position.set(x,4.481,z)
      glareTransform.rotation.set(-Math.PI/2,0,0)
      glareTransform.scale.set(2.15,.43,1)
      glareTransform.updateMatrix()
      glare.setMatrixAt(glareIndex++,glareTransform.matrix)
    }
  }
  glare.instanceMatrix.needsUpdate=true
  glare.name='Batched luminous fixture glare'
  glare.renderOrder=2
  ceiling.add(glare)

  // The old bright directional light produced sun-like shadows under an
  // indoor ceiling and flattened every surface with excessive fill.
  // Two overhead spots give direct/specular response and cast distinct
  // overlapping robot/shelf shadows in Realistic. Balanced uses one shadow
  // map; the additional static floor AO is computed only once.
  const ambient=new THREE.HemisphereLight(0xf6ffff,0x71827f,.8)
  interior.add(ambient)
  // Rectangular softbox sources add broad specular streaks to PBR surfaces;
  // their large LTC lookup library is only downloaded on first Realistic use.
  // In WebGL area lights do NOT cast shadows, hence the separate spots below.
  let disposed=false
  let wantsSpecularPanels=false
  let specularPanels:THREE.RectAreaLight[]=[]
  let specularLoad:Promise<void>|undefined
  const setSpecularPanels=(visible:boolean)=>{
    wantsSpecularPanels=visible
    for(const panel of specularPanels)panel.visible=visible
    if(!visible||specularLoad)return
    specularLoad=import('three/addons/lights/RectAreaLightUniformsLib.js')
      .then(({RectAreaLightUniformsLib})=>{
        if(disposed)return
        RectAreaLightUniformsLib.init()
        specularPanels=([
          [2.3,-2.1],[7.15,2.0],
        ] as const).map(([x,z])=>{
          const panel=new THREE.RectAreaLight(0xfff4e8,5.4,3.8,.3)
          panel.position.set(x,4.47,z)
          panel.lookAt(x,0,z)
          panel.visible=wantsSpecularPanels
          interior.add(panel)
          return panel
        })
      }).catch(error=>console.warn('Optional area-light highlights unavailable',error))
  }
  const shadowFixtures=([
    [2.3,-.6],[7.15,1.2],
  ] as const).map(([x,z])=>{
    const lamp=new THREE.SpotLight(0xfff1dc,63,13,1.03,.78,2)
    lamp.position.set(x,4.43,z)
    lamp.target.position.set(x,0,z)
    lamp.shadow.mapSize.set(512,512)
    lamp.shadow.camera.near=.35
    lamp.shadow.camera.far=14
    lamp.shadow.bias=-.00016
    lamp.shadow.normalBias=.018
    interior.add(lamp,lamp.target)
    return lamp
  })
  const lightClusters=([
    [-1.25,-3.5],[7,-3.5],[-1.25,3.15],[7,3.15],
  ] as const).map(([x,z])=>{
    const light=new THREE.PointLight(0xfff2e1,19,10,2)
    light.position.set(x,4.25,z)
    light.castShadow=false
    interior.add(light)
    return light
  })

  const rack=new THREE.Group()
  rack.name='PBR shelving and merchandise'
  interior.add(rack)
  const border=baseMaterial(0xe5efee,.51,.16)
  const band=baseMaterial(0x2c706f,.42,.23)
  for(const o of supermarketObstacles){
    // Position each box directly in the rack's coordinate system. Batching
    // by material now spans *all* fixtures, not one draw per shelf/material.
    // This has identical world transforms to the previous translated roots.
    const fixtureBox=(
      w:number,h:number,d:number,x:number,y:number,z:number,
      material:THREE.Material,castShadow=false,
    )=>addBox(rack,unit,w,h,d,o.x+x,y,o.z+z,material,castShadow)
    if(o.kind==='obstruction'){
      // Render-only pallet display occupies the same canonical obstacle AABB.
      // This broadphase fixture is not replaced in the Modelica geometry.
      continue
    }else{
      const width=o.halfX*2
      const depth=o.halfZ*2
      for(const z of [-o.halfZ,o.halfZ])
        for(const x of [-o.halfX,o.halfX])
          fixtureBox(.047,o.height,.047,x,o.height/2,z,steel,true)
      for(let level=0;level<5;level++){
        const y=.27+level*.39
        fixtureBox(width,.055,depth,0,y,0,shopWhite,true)
        for(const side of [-1,1]){
          fixtureBox(width,.072,.023,0,y+.015,side*(o.halfZ-.015),border)
          fixtureBox(width,.021,.028,0,y-.019,side*(o.halfZ+.002),band)
        }
      }
      fixtureBox(width+.04,.077,depth+.04,0,2.07,0,trim)
      for(const x of [-o.halfX,o.halfX]){
        fixtureBox(.025,1.76,depth-.03,x,1.12,0,billboard)
      }
    }
  }
  const stock=createSupermarketStock(rack)
  const decor=createSupermarketDecor(room,rack)
  const decorativeProductCount=stock.products

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
  const farWallSign=new THREE.Mesh(
    new THREE.PlaneGeometry(3.8,1),
    new THREE.MeshBasicMaterial({
      map:signTexture('FRESH MARKET'),
      side:THREE.DoubleSide,
    }),
  )
  farWallSign.position.set(14.1,3.65,0)
  farWallSign.rotation.y=-Math.PI/2
  farWallSign.name='Far-aisle wall sign (render-only)'
  rack.add(farWallSign)
  flushStaticBoxes(unit)
  // Large flat walls/ceiling can use baked color in Performance mode.
  // Keep Lambert shading for the smaller 3D fixtures that need depth cues.
  const fastFixtureMaterials=new Map<THREE.MeshStandardMaterial,THREE.Material>()
  const fastBackgroundMaterials=new Map<THREE.MeshStandardMaterial,THREE.Material>()
  const architecture:Array<{
    mesh:THREE.InstancedMesh
    original:THREE.MeshStandardMaterial
    fast:THREE.Material
  }>=[]
  interior.traverse(object=>{
    if(!(object instanceof THREE.InstancedMesh)||
      object.name!=='Instanced store architecture'||
      !(object.material instanceof THREE.MeshStandardMaterial))return
    const original=object.material
    const isFixture=object.parent===rack
    const fallbackMaterials=isFixture?fastFixtureMaterials:fastBackgroundMaterials
    let fast=fallbackMaterials.get(original)
    if(!fast){
      fast=isFixture
        ? new THREE.MeshLambertMaterial({color:original.color,map:original.map})
        : new THREE.MeshBasicMaterial({color:original.color,map:original.map})
      fallbackMaterials.set(original,fast)
    }
    architecture.push({mesh:object,original,fast})
  })
  const environment=createStudioReflection()
  scene.environment=environment
  scene.background=new THREE.Color(0x9eb3b5)
  scene.fog=new THREE.FogExp2(0x9eb3b5,.012)

  const setVisualQuality=(
    quality:'high'|'balanced'|'performance',effects:GraphicsEffects,
  )=>{
    // Render-only settings. The scene remains independent from all physics
    // geometry, Modelica outputs and recorded LiDAR/SLAM observations.
    const low=quality==='performance'
    const pbr=effects.reflections||effects.surfaceDetail
    stock.setQuality(low&&pbr?'balanced':quality)
    shadows.visible=effects.contactShadows
    seams.setQuality(quality,effects.contactShadows)
    shadowMaterial.opacity=quality==='high' ? .89 : .74
    for(const {mesh,original,fast} of architecture)
      mesh.material=low&&!pbr?fast:original
    scene.environment=effects.reflections?environment:null
    scene.environmentIntensity=quality==='high' ? .95 : .7
    const setMaps=(
      material:THREE.MeshStandardMaterial,
      normal:THREE.Texture,rough:THREE.Texture,
    )=>{
      const targetNormal=effects.surfaceDetail?normal:null
      const targetRoughness=effects.surfaceDetail?rough:null
      if(material.normalMap!==targetNormal||material.roughnessMap!==targetRoughness){
        material.normalMap=targetNormal
        material.roughnessMap=targetRoughness
        material.needsUpdate=true
      }
    }
    for(const metal of [steel,trim,fixture])
      setMaps(metal,brushedSteel.normal,brushedSteel.rough)
    setMaps(floorHigh,floorMaps.normal,floorMaps.roughness)
    setMaps(floorBalanced,floorMaps.normal,floorMaps.roughness)
    led.emissiveIntensity=effects.lighting
      ? (quality==='high'?3.1:low?0.75:1.9) : 0
    glare.visible=effects.glare
    glareMaterial.opacity=quality==='high' ? .62 : .32
    ambient.intensity=quality==='high' ? .58 : low ? 1.4 : .82
    for(const [index,light] of lightClusters.entries()){
      light.visible=effects.lighting&&(quality==='high'||index===0||index===3)
    }
    setSpecularPanels(!softwareRenderer&&effects.lighting&&quality==='high')
    const shadowBudget=ceilingShadowBudget(quality,effects.castShadows)
    for(const [index,lamp] of shadowFixtures.entries()){
      lamp.visible=effects.lighting&&(quality==='high'||index===0)
      lamp.castShadow=index<shadowBudget
      lamp.shadow.mapSize.set(quality==='high'?512:768,quality==='high'?512:768)
    }
    floorHigh.aoMapIntensity=effects.contactShadows?1.35:0
    floorBalanced.aoMapIntensity=effects.contactShadows ? .95 : 0
    // Even at low render resolution, a manually enabled dynamic shadow needs
    // a lit receiving floor; MeshBasicMaterial cannot display shadow maps.
    floor.material=low&&!pbr&&!effects.castShadows?floorPerformance:
      quality==='high'?floorHigh:floorBalanced
  }
  return {
    decorativeProductCount,overheadLights:lamps,
    setVisualQuality,
    whenExtraLightingReady:()=>specularLoad??Promise.resolve(),
    setCeilingVisible:visible=>{ceiling.visible=visible},
    dispose:()=>{
      disposed=true
      stock.dispose()
      decor.dispose()
      floorMaps.dispose()
      brushedSteel.dispose()
      staticOcclusion.dispose()
      scene.remove(interior)
      interior.traverse(object=>{
        if(object instanceof THREE.Mesh){
          object.geometry.dispose()
          if(Array.isArray(object.material))
            object.material.forEach(m=>m.dispose())
          else object.material.dispose()
        }
      })
      for(const material of [floorHigh,floorBalanced,floorPerformance])material.dispose()
      for(const {original,fast} of architecture){original.dispose();fast.dispose()}
      shadowTexture.dispose()
      seams.dispose()
      glareGeometry.dispose()
      glareMaterial.dispose()
      glareTexture.dispose()
      environment.dispose()
    },
  }
}
