import * as THREE from 'three'
import {createSupermarketInterior} from '../viewer/supermarket-interior.ts'
import {presetGraphicsEffects} from '../viewer/graphics-settings.ts'

type Quality='high'|'balanced'|'performance'
type Configuration=Readonly<{
  quality:Quality
  pixelRatio:number
  shadows?:boolean
  floor?:boolean
  products?:boolean
  room?:boolean
  rack?:boolean
  ceiling?:boolean
  unlit?:boolean
  lambertStock?:boolean
  lambertAll?:boolean
  architecturePbr?:boolean
  contactShadows?:boolean
}>
const WIDTH=1100
const HEIGHT=650

const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'})
renderer.setSize(WIDTH,HEIGHT)
renderer.shadowMap.enabled=true
renderer.shadowMap.type=THREE.PCFSoftShadowMap
renderer.outputColorSpace=THREE.SRGBColorSpace
renderer.toneMapping=THREE.ACESFilmicToneMapping
renderer.toneMappingExposure=1.10
document.body.append(renderer.domElement)

const scene=new THREE.Scene()
const camera=new THREE.PerspectiveCamera(65,WIDTH/HEIGHT,.1,90)
camera.position.set(-2.35,1.68,-.1)
camera.lookAt(6.9,1.55,-.1)
const interior=createSupermarketInterior(scene,renderer)
const visual=scene.getObjectByName('Visual supermarket architecture (non-collidable)')
if(!visual)throw Error('Supermarket visual scene missing')
const room=visual.children.find(object=>object.type==='Group' && object.name==='')
const rack=scene.getObjectByName('PBR shelving and merchandise')
const ceiling=scene.getObjectByName('Cutaway acoustic ceiling and suspended linear LEDs')
const floor=scene.getObjectByName('PBR polished terrazzo tile floor')
if(!room||!rack||!ceiling||!floor)throw Error('Supermarket benchmark layer missing')
const architecture:Array<{mesh:THREE.Mesh;original:THREE.Material}>=[]
visual.traverse(object=>{
  if(object instanceof THREE.Mesh&&object.name==='Instanced store architecture')
    architecture.push({mesh:object,original:object.material as THREE.Material})
})
const contactShadows=scene.getObjectByName('Visual-only fixture contact shading')
const stock:THREE.Object3D[]=[]
rack.traverse(object=>{
  if(object.name.startsWith('Photographic-layout shelf stock:') ||
    object.name==='Shelf edge price labels' ||
    object.name==='Performance-mode instanced colored retail stock'){
    stock.push(object)
  }
})
const stockMaterialPairs=stock.filter((object):object is THREE.Mesh=>
  object instanceof THREE.Mesh && object.name.startsWith('Photographic-layout shelf stock:')
).map(mesh=>{
  const original=mesh.material as THREE.MeshStandardMaterial
  const lambert=new THREE.MeshLambertMaterial({map:original.map,color:original.color})
  return {mesh,original,lambert}
})
const unlit=new THREE.MeshBasicMaterial({color:0xdddddd})
const lambertAll=new THREE.MeshLambertMaterial({color:0xdddddd})
const gl=renderer.getContext()
const gpuInfo=gl.getExtension('WEBGL_debug_renderer_info')
const gpu={
  renderer:String(gl.getParameter(gpuInfo?gpuInfo.UNMASKED_RENDERER_WEBGL:gl.RENDERER)),
  vendor:String(gl.getParameter(gpuInfo?gpuInfo.UNMASKED_VENDOR_WEBGL:gl.VENDOR)),
  timerQuery:!!gl.getExtension('EXT_disjoint_timer_query_webgl2'),
}

/** Called by Playwright. RAF measures full frame pacing; render() timings
 * separately measure JS submission, not GPU rasterization or presentation. */
const measure=async(options:Configuration,durationMs=4000)=>{
  interior.setVisualQuality(options.quality,presetGraphicsEffects(options.quality))
  // Realistic's rectangular-light LTC tables load lazily: measure after
  // they are actually in the scene, not just the loading frame.
  await interior.whenExtraLightingReady()
  renderer.toneMappingExposure=options.quality==='high' ? .94 :
    options.quality==='balanced' ? .99 : 1.08
  renderer.setPixelRatio(options.pixelRatio)
  renderer.shadowMap.enabled=options.shadows ?? options.quality!=='performance'
  renderer.shadowMap.needsUpdate=true
  room.visible=options.room!==false
  rack.visible=options.rack!==false
  ceiling.visible=options.ceiling!==false
  floor.visible=options.floor!==false
  if(contactShadows)contactShadows.visible=options.contactShadows!==false
  if(options.architecturePbr)
    architecture.forEach(({mesh,original})=>{mesh.material=original})
  if(options.products===false){
    stock.forEach(mesh=>{mesh.visible=false})
  }
  stockMaterialPairs.forEach(({mesh,original,lambert})=>{
    mesh.material=options.lambertStock?lambert:original
  })
  scene.overrideMaterial=options.unlit?unlit:options.lambertAll?lambertAll:null
  // First draw compiles shaders and uploads meshes; exclude from warm timings.
  renderer.render(scene,camera)
  gl.finish()
  const durations:number[]=[]
  let draws=0
  let triangles=0
  let frames=0
  const start=performance.now()
  await new Promise<void>(resolve=>{
    const tick=()=>{
      const frameStart=performance.now()
      renderer.render(scene,camera)
      durations.push(performance.now()-frameStart)
      frames++
      draws+=renderer.info.render.calls
      triangles+=renderer.info.render.triangles
      if(performance.now()-start<durationMs)requestAnimationFrame(tick)
      else resolve()
    }
    requestAnimationFrame(tick)
  })
  const wallMs=performance.now()-start
  durations.sort((a,b)=>a-b)
  return {
    options,
    wallMs,frames,
    fps:1000*frames/wallMs,
    renderSubmissionMedianMs:durations[Math.floor(durations.length/2)] ?? null,
    averageDraws:draws/frames,
    averageTriangles:triangles/frames,
    gpu,
  }
}
Object.assign(window,{__realityloopRenderBenchmark:{measure,gpu}})
