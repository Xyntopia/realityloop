import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { createSupermarketInterior } from './supermarket-interior.ts'
import { createSupermarketPostFX } from './supermarket-postfx.ts'
import { createRobotContactShadow } from './contact-shading.ts'
import {
  shouldCaptureSensorPreview,updateAutoQuality,
  type VisualQuality,type AutoQualityState,
} from './render-policy.ts'
import type { TennantResult, TennantScenario } from '../src/tennant.ts'
import type { SupermarketReplay } from '../src/modelica/supermarket.ts'
import { createTennantT7AMR } from './tennant.ts'
import { SlamView } from './slam-view.ts'
import './theme.css'
import './style.css'

const elem = (id:string) => {
  const node=document.getElementById(id)
  if(!node)throw Error('Missing element '+id)
  return node
}
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(43,innerWidth/innerHeight,0.1,90)
camera.position.set(12,10,14)
const renderer = new THREE.WebGLRenderer({antialias:true, powerPreference:'high-performance'})
renderer.setSize(innerWidth,innerHeight)
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5))
renderer.shadowMap.enabled=true
renderer.shadowMap.type=THREE.PCFSoftShadowMap
renderer.outputColorSpace=THREE.SRGBColorSpace
renderer.toneMapping=THREE.ACESFilmicToneMapping
renderer.toneMappingExposure=1.10
elem('scene').append(renderer.domElement)
const controls = new OrbitControls(camera,renderer.domElement)
controls.target.set(4,0,0)
controls.enableDamping=true
controls.maxPolarAngle=Math.PI*0.46
controls.update()

// The visual scene is intentionally not part of Modelica's obstacle/physics DAG.
const interior = createSupermarketInterior(scene,renderer)
const graphicsSelect=elem('visual-quality') as HTMLSelectElement
const gl=renderer.getContext()
const rendererInfo=gl.getExtension('WEBGL_debug_renderer_info')
const rendererName=String(gl.getParameter(
  rendererInfo?rendererInfo.UNMASKED_RENDERER_WEBGL:gl.RENDERER))
const softwareRenderer=/swiftshader|llvmpipe|softpipe|software|lavapipe/i.test(rendererName)
document.body.classList.toggle('software-renderer',softwareRenderer)
const postFX=createSupermarketPostFX(renderer,scene,camera,softwareRenderer)
const robot=createTennantT7AMR()
const contactShadow=createRobotContactShadow()
robot.add(contactShadow.mesh)
scene.add(robot)
let graphicsQuality:VisualQuality='high'
const applyQuality=(quality:VisualQuality)=>{
  if(quality===graphicsQuality && renderer.getPixelRatio()===
      Math.min(devicePixelRatio,quality==='high'?1.5:quality==='balanced'?1:.48))return
  graphicsQuality=quality
  renderer.setPixelRatio(Math.min(devicePixelRatio,
    quality==='high'?1.5:quality==='balanced'?1:.48))
  renderer.shadowMap.enabled=quality!=='performance'
  renderer.shadowMap.needsUpdate=true
  interior.setVisualQuality(quality)
  postFX.setQuality(quality,innerWidth,innerHeight)
  contactShadow.setQuality(quality)
}
applyQuality(softwareRenderer?'performance':'balanced')
const goal = new THREE.Mesh(new THREE.RingGeometry(0.43,0.51,48),new THREE.MeshBasicMaterial({color:0xf78f3b,side:THREE.DoubleSide}))
goal.rotation.x=-Math.PI/2;goal.position.set(7.5,0.016,0);scene.add(goal)
const slamView=new SlamView(elem('slam-map') as HTMLCanvasElement,scene)
const trailGeometry=new THREE.BufferGeometry()
const trailMaterial=new THREE.LineBasicMaterial({color:0xd6deea,transparent:true,opacity:0.95})
const trail=new THREE.Line(trailGeometry,trailMaterial)
scene.add(trail)
const coverageGeometry=new THREE.PlaneGeometry(0.22,0.22)
const coverageMaterial=new THREE.MeshBasicMaterial({color:0xf78f3b,transparent:true,opacity:0.17,depthWrite:false,side:THREE.DoubleSide})
const coverage=new THREE.InstancedMesh(coverageGeometry,coverageMaterial,6000)
coverage.count=0
coverage.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
coverage.frustumCulled=false
scene.add(coverage)
const footprintCells=new Set<string>()
const stamp=new THREE.Object3D()
stamp.rotation.x=-Math.PI/2
const addCoverage=(x:number,z:number)=>{
  const key=Math.floor(x/0.22)+':'+Math.floor(z/0.22)
  if(footprintCells.has(key)||coverage.count>=6000)return
  footprintCells.add(key)
  stamp.position.set(x,0.012,z)
  stamp.updateMatrix()
  coverage.setMatrixAt(coverage.count++,stamp.matrix)
  coverage.instanceMatrix.needsUpdate=true
}
const format=(n:number,p=2)=>Number.isFinite(n)?n.toFixed(p):'—'
const base:Omit<TennantScenario,'route'|'name'>={
  vehicle:'tennant-t7amr',
  timestepSeconds:1/120,steps:7200,frictionCoefficient:0.72,seed:42,
}
let result: TennantResult | SupermarketReplay | null = null
let sampleIndex=0
let lastPaintedSample=-1
let playing=true
let generation=0
let lastFrameTime=performance.now()
let elapsedPlayback=0
const setStatus=(status:string)=>{elem('status').textContent=status}
const resetVisual=()=>{
  sampleIndex=0;lastPaintedSample=-1;elapsedPlayback=0
  trailGeometry.setFromPoints([])
  coverage.count=0
  slamView.reset()
  footprintCells.clear()
}
const run=async(route:'blocked'|'detour')=>{
  const current=++generation
  playing=false;elem('play').textContent='Play'
  const engine=(elem('engine') as HTMLSelectElement).value
  result=null
  resetVisual()
  setStatus(engine==='modelica'?'Compiling & integrating Modelica physics…':'Computing legacy Rapier physics…')
  try{
    const next=engine==='modelica'
      ? await import('./modelica-supermarket.ts').then(m=>m.runModelicaSupermarket(route))
      : await Promise.all([
          import('../src/tennant.ts'),import('../src/dag-browser.ts'),
        ]).then(async ([m,dag])=>{
          const scenario=m.parseTennantScenario({...base,route,name:'tennant-t7amr-'+route})
          const result=await dag.runBrowserDag(scenario,
            {provider:'rapier',version:'0.21.0',model:'TennantDrive-v1'},
            input=>m.runTennantScenario(m.parseTennantScenario(input)))
          return result.result
        })
    if(current!==generation)return
    result=next;resetVisual();playing=true;elem('play').textContent='Pause'
    elem('engine-label').textContent=engine==='modelica'
      ? 'RUMOCA MODELICA · COMPILER-DRIVEN REPLAY'
      : 'RAPIER WASM · LEGACY COMPARISON REPLAY'
    elem('secondary-label').textContent=engine==='modelica'?'Contact mode':'Lateral slip'
    setStatus('SIMULATING · '+(route==='detour'?'DETOUR':'BLOCKED ROUTE'))
  }catch(e){setStatus('Error: '+String(e))}
}
const displaySample=(i:number)=>{
  if(!result)return
  const sample=result.observations[i]
  if(!sample)return
  // Physical telemetry comes from the scenario run, not Three.js interpolation.
  robot.position.set(sample.x,0,sample.z)
  robot.rotation.y=sample.yaw
  elem('time').textContent=format(sample.timeSeconds,1)+' s'
  elem('distance').textContent=format(Math.hypot(7.5-sample.x,sample.z))+' m'
  elem('velocity').textContent=format(sample.speed)+' m/s'
  elem('coverage').textContent=format(sample.cleanedAreaSqMetres)+' m²'
  elem('slip-l').textContent=format(sample.driveWheelSlip)+' m/s'
  elem('clearance').textContent='minimumSweptClearanceMetres' in result.result
    ? format(result.result.minimumSweptClearanceMetres)+' m' : '—'
  const contactMode='contactMode' in sample ? sample.contactMode : undefined
  elem('slip-r').textContent=contactMode===undefined
    ? format(sample.lateralSlip)+' m/s'
    : contactMode===0?'STICK':contactMode>0?'SLIDE +':'SLIDE −'
  elem('frame').textContent='SAMPLE '+(i+1)+' / '+result.observations.length
  trailGeometry.setFromPoints(result.observations.slice(0,i+1).map(p=>new THREE.Vector3(p.x,0.04,p.z)))
  for(let k=lastPaintedSample+1;k<=i;k++){
    const point=result.observations[k]
    for(let j=-2;j<=2;j++)addCoverage(point.x+0.13*j*Math.sin(point.yaw),point.z+0.13*j*Math.cos(point.yaw))
    slamView.step({x:point.x,z:point.z,yaw:point.yaw}, k===i, point.speed, point.timeSeconds)
  }
  lastPaintedSample=i
}
let lastCameraRender=-Infinity
let fpsWindowStart=performance.now()
let autoQuality:AutoQualityState={
  quality:graphicsQuality,slowWindows:0,fastWindows:0,
}
let fpsFrames=0
const render=(now:number)=>{
  const delta=Math.min((now-lastFrameTime)/1000,0.5);lastFrameTime=now
  if(result&&playing){
    elapsedPlayback+=delta*Number((elem('speed') as HTMLSelectElement).value)
    // Binary search by the actual solver time. Rumoca adds event-state samples,
    // so a fixed-index/step extrapolation silently loses temporal accuracy.
    const samples=result.observations
    let lo=0,hi=samples.length-1
    while(lo<hi){
      const mid=Math.ceil((lo+hi)/2)
      if(samples[mid].timeSeconds<=elapsedPlayback)lo=mid
      else hi=mid-1
    }
    const index=lo
    if(index!==sampleIndex){sampleIndex=index;displaySample(index)}
    if(index===result.observations.length-1){
      playing=false;elem('play').textContent='Play'
      setStatus(result.result.passed?'COMPLETE · GOAL REACHED':
        'failureReason' in result.result && result.result.failureReason==='unsafeClearance'
          ? 'FAILED · UNSAFE CLEARANCE' : 'FAILED · ROUTE BLOCKED')
    }
  }
  controls.update()
  postFX.render()
  fpsFrames++
  if(now-fpsWindowStart>=1000){
    const fps=Math.round(fpsFrames*1000/(now-fpsWindowStart))
    if(graphicsSelect.value==='auto' && !softwareRenderer && !document.hidden &&
       now>5000){
      autoQuality=updateAutoQuality(autoQuality,fps)
      if(autoQuality.quality!==graphicsQuality)applyQuality(autoQuality.quality)
    }
    elem('render-stats').textContent=fps+' FPS · '+renderer.info.render.calls+
      ' DRAWS · '+interior.decorativeProductCount+' PRODUCTS · '+graphicsQuality.toUpperCase()
    fpsFrames=0
    fpsWindowStart=now
  }
  if(shouldCaptureSensorPreview({
    now,lastCapture:lastCameraRender,quality:graphicsQuality,
    panelsVisible:!document.body.classList.contains('showcase'),
    pageVisible:!document.hidden,
  })){
    slamView.renderCamera(robot,scene)
    lastCameraRender=now
  }
  requestAnimationFrame(render)
}
elem('play').addEventListener('click',()=>{
  if(!result)return
  if(!playing&&sampleIndex===result.observations.length-1){resetVisual();displaySample(0)}
  playing=!playing;elem('play').textContent=playing?'Pause':'Play'
})
elem('replay').addEventListener('click',()=>{if(!result)return;resetVisual();displaySample(0);playing=true;elem('play').textContent='Pause';setStatus('REPLAYING · RECORDED TRACE')})
elem('engine').addEventListener('change',()=>void run((elem('route') as HTMLSelectElement).value as 'blocked'|'detour'))
elem('route').addEventListener('change',()=>void run((elem('route') as HTMLSelectElement).value as 'blocked'|'detour'))
elem('lidar-toggle').addEventListener('click',()=>{const visible=slamView.toggleRays();elem('lidar-toggle').textContent=visible?'Hide rays':'Show rays'})
graphicsSelect.addEventListener('change',()=>{
  const selected=graphicsSelect.value
  if(selected==='auto')applyQuality(softwareRenderer?'performance':'balanced')
  else if(selected==='high'||selected==='balanced'||selected==='performance')
    applyQuality(selected)
  autoQuality={quality:graphicsQuality,slowWindows:0,fastWindows:0}
})
type CameraMode='orbit'|'top'|'aisle'
let cameraMode:CameraMode='orbit'
const syncPresentationGeometry=()=>{
  const diagnosticsVisible=!document.body.classList.contains('showcase')&&
    cameraMode!=='aisle'
  goal.visible=diagnosticsVisible
  trail.visible=diagnosticsVisible
  coverage.visible=diagnosticsVisible
  slamView.setOverlaysVisible(diagnosticsVisible)
}
elem('presentation').addEventListener('click',()=>{
  const hidden=document.body.classList.toggle('showcase')
  elem('presentation').textContent=hidden?'Show panels':'Hide panels'
  syncPresentationGeometry()
})
const setCameraMode=(mode:CameraMode)=>{
  cameraMode=mode
  if(mode==='top'){
    camera.position.set(4.4,17,0.1)
    controls.target.set(4,0,0)
    camera.fov=43
  }else if(mode==='aisle'){
    // Generic eye-height aisle camera; no external reference image is required.
    camera.position.set(-2.35,1.68,-.1)
    controls.target.set(6.9,1.55,-.1)
    camera.fov=65
  }else{
    camera.position.set(12,10,14)
    controls.target.set(4,0,0)
    camera.fov=43
  }
  camera.updateProjectionMatrix()
  interior.setCeilingVisible(mode!=='top')
  syncPresentationGeometry()
  controls.enabled=mode!=='aisle'
  controls.update()
  elem('camera').textContent=mode==='top'?'Perspective':'Top view'
  elem('aisle-camera').textContent=mode==='aisle'?'Exit aisle view':'Aisle view'
}
elem('camera').addEventListener('click',()=>setCameraMode(cameraMode==='top'?'orbit':'top'))
elem('aisle-camera').addEventListener('click',()=>setCameraMode(cameraMode==='aisle'?'orbit':'aisle'))
addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth,innerHeight)
  postFX.resize(innerWidth,innerHeight)
})
void slamView.enablePclIcp()
void run('detour')
requestAnimationFrame(render)
