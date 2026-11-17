import * as THREE from 'three'
import {
  runMissionExperiment,type MissionResult,type MissionScenario,
} from '../src/mission-experiments.ts'
import {runBrowserDag} from '../src/dag-browser.ts'
import {createMissionWorld,type MissionScene} from './mission-scene.ts'
import {isSoftwareRenderer} from './renderer-capabilities.ts'

const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T
const validScenes:readonly MissionScene[]=['satellite','docking','mars','construction']
const requested=new URLSearchParams(location.search).get('scene')
let kind:MissionScene=validScenes.includes(requested as MissionScene)
  ?requested as MissionScene:'satellite'
const metadata:Record<MissionScene,{
  name:string;description:string;limit:string;tag:string;
}>={
  satellite:{
    name:'Modular satellite attitude control',
    description:'Reconfigure seven 40 cm modules and watch how the inertia tensor changes a reaction-wheel attitude manoeuvre.',
    limit:'3-axis rigid-body Euler dynamics, a bounded PD reaction-wheel controller and a recomputed full inertia tensor. No orbit propagation, flexible modes, disturbance calibration or flight-qualified ADCS.',
    tag:'RECONFIGURABLE SPACECRAFT',
  },
  docking:{
    name:'iBOSS modular docking',
    description:'Guide one intelligent building block toward a standardized modular interface with a bounded-thrust approach and gated latch.',
    limit:'Relative translation and interface capture criteria only; no 6-DOF manipulator, contact compliance, thermal/power bus or rendezvous orbital mechanics.',
    tag:'ON-ORBIT SERVICING',
  },
  mars:{
    name:'Mars rover terrain traverse',
    description:'Drive a six-wheel concept rover across synthetic Martian topography while avoiding boulders and respecting local traction limits.',
    limit:'Reduced-order steering, slope and traction dynamics; no suspension, deformable regolith, wheel-soil terramechanics, terrain-specific LiDAR or autonomous SLAM.',
    tag:'PLANETARY EXPLORATION',
  },
  construction:{
    name:'Autonomous construction delivery',
    description:'Route a mobile construction vehicle around equipment and a marked exclusion zone to deliver material across uneven ground.',
    limit:'Planar traction/grade dynamics and conservative circular hazard clearance. No validated excavator/loader hydraulics, operator safety envelope or site survey.',
    tag:'CONSTRUCTION ROBOTICS',
  },
}
const scenarioFor=():MissionScenario=>{
  const name=kind
  if(kind==='satellite')return {
    kind:'satellite-adcs',name:'modular-attitude-pointing',
    layout:$<HTMLSelectElement>('module-layout').value as 'compact'|'distributed'|'asymmetric',
    durationSeconds:100,intervalSeconds:.05,torqueLimitNm:.3,
  }
  if(kind==='docking')return {
    kind:'orbital-docking',name:'iboss-interface-soft-capture',
    durationSeconds:65,intervalSeconds:.05,thrusterLimitN:3,
  }
  return {
    kind:'terrain-traverse',
    name:kind==='mars'?'mars-six-wheel-route':'construction-material-delivery',
    terrain:kind,durationSeconds:kind==='mars'?110:70,
    intervalSeconds:.05,
    frictionCoefficient:Number($<HTMLInputElement>('friction').value),
    ...(kind==='mars'?{roverCandidate:$<HTMLSelectElement>('rover-candidate').value as
      'ares-rtg'|'helios-solar'|'pathfinder-light'}:{}),
  }
}
let world=createMissionWorld(kind)
const renderer=new THREE.WebGLRenderer({
  antialias:true,powerPreference:'high-performance',alpha:false,
})
renderer.outputColorSpace=THREE.SRGBColorSpace
renderer.toneMapping=THREE.ACESFilmicToneMapping
renderer.toneMappingExposure=1.07
renderer.shadowMap.enabled=!isSoftwareRenderer(renderer)
renderer.shadowMap.type=THREE.PCFSoftShadowMap
renderer.setPixelRatio(Math.min(devicePixelRatio,1.35))
$<HTMLDivElement>('viewport').append(renderer.domElement)
let model:MissionResult|undefined
let frames:Record<string,any>[]=[]
let currentIndex=0
let playing=true
let playbackTime=0
let requestGeneration=0
let lastTick=performance.now()
const fit=()=>{
  const host=$<HTMLElement>('viewport')
  const width=Math.max(1,host.clientWidth),height=Math.max(1,host.clientHeight)
  renderer.setSize(width,height,false)
  world.camera.aspect=width/height
  world.camera.updateProjectionMatrix()
}
window.addEventListener('resize',fit)
new ResizeObserver(fit).observe($('viewport'))
const metric=(n:string,value:string,label:string)=>{
  $(n).textContent=value
  $(n+'-label').textContent=label
}
const summary=(result:MissionResult)=>{
  if('finalErrorDegrees' in result.result){
    const r=result.result
    metric('metric-a',r.finalErrorDegrees.toFixed(2)+'°','FINAL POINTING ERROR')
    metric('metric-b',r.totalMassKg+' kg','MODULE ASSEMBLY MASS')
    metric('metric-c',r.inertia[1][1].toFixed(1),'Y-AXIS INERTIA · KG M²')
    metric('metric-d',String(r.modules),'CONNECTED MODULES')
  }else if('docked' in result.result){
    const r=result.result
    metric('metric-a',r.docked?'CAPTURED':'MISSED','DOCKING STATUS')
    metric('metric-b',r.finalDistanceMetres.toFixed(3)+' m','INTERFACE OFFSET')
    metric('metric-c',r.relativeSpeedMetresPerSecond.toFixed(3)+' m/s','RELATIVE SPEED')
    metric('metric-d',r.timeToCaptureSeconds===null?'—':
      r.timeToCaptureSeconds.toFixed(1)+' s','CAPTURE TIME')
  }else{
    const r=result.result
    metric('metric-a',r.goalReached?'ARRIVED':'EN ROUTE','DELIVERY / TRAVERSE')
    metric('metric-b',r.goalDistanceMetres.toFixed(2)+' m','GOAL DISTANCE')
    metric('metric-c',r.minimumClearanceMetres.toFixed(2)+' m','MINIMUM CLEARANCE')
    metric('metric-d',r.candidate??r.gravityMetresPerSecondSquared.toFixed(2)+' m/s²',
      r.candidate?'ROVER CONFIGURATION':'LOCAL GRAVITY')
  }
}
const telemetryValue=(sample:Record<string,any>):number=>{
  if(kind==='satellite')return sample.errorDegrees??0
  if(kind==='docking')return sample.distanceMetres??0
  return sample.distanceToGoalMetres??0
}
const chart=()=>{
  const canvas=$<HTMLCanvasElement>('telemetry')
  const ctx=canvas.getContext('2d')
  if(!ctx||!frames.length)return
  const w=canvas.width,h=canvas.height
  ctx.fillStyle='#192739';ctx.fillRect(0,0,w,h)
  ctx.strokeStyle='#30465c';ctx.lineWidth=1
  for(let n=1;n<4;n++){
    ctx.beginPath();ctx.moveTo(0,n*h/4);ctx.lineTo(w,n*h/4);ctx.stroke()
  }
  const max=Math.max(...frames.map(telemetryValue),.0001)
  ctx.strokeStyle='#f78f3b';ctx.lineWidth=2
  ctx.beginPath()
  for(let i=0;i<frames.length;i++){
    const x=(i/(frames.length-1))*w
    const y=h-12-(telemetryValue(frames[i])/(max*1.08))*(h-22)
    if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)
  }
  ctx.stroke()
  const x=currentIndex/Math.max(1,frames.length-1)*w
  ctx.strokeStyle='#e7eff8';ctx.lineWidth=1
  ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()
}
const showFrame=(index:number)=>{
  if(!frames.length)return
  currentIndex=Math.max(0,Math.min(index,frames.length-1))
  const frame=frames[currentIndex]
  world.move(frame)
  $<HTMLInputElement>('timeline').value=String(currentIndex)
  $('timeline-time').textContent=frame.timeSeconds.toFixed(1)+' s'
  chart()
}
const resetWorld=()=>{
  const old=world.scene
  old.traverse(object=>{
    if(object instanceof THREE.Mesh)object.geometry.dispose()
    if(object instanceof THREE.Points)object.geometry.dispose()
  })
  world=createMissionWorld(kind,
    $<HTMLSelectElement>('module-layout').value as 'compact'|'distributed'|'asymmetric')
  fit()
}
const run=async()=>{
  const generation=++requestGeneration
  const button=$<HTMLButtonElement>('simulate')
  button.disabled=true
  $('mission-status').textContent='Running canonical Design Graph experiment…'
  try{
    const scenario=scenarioFor()
    resetWorld()
    const executed=await runBrowserDag(scenario,
      {model:'mission-physics/v1',scene:kind},
      input=>runMissionExperiment(input))
    if(generation!==requestGeneration)return
    model=executed.result
    frames=[...model.observations] as Record<string,any>[]
    $<HTMLInputElement>('timeline').max=String(Math.max(0,frames.length-1))
    $('mission-engine').textContent=model.engine.name+' · '+model.engine.model
    $('mission-artifact').textContent=executed.artifactHash.slice(0,25)+'…'
    $('mission-status').textContent=model.result.passed
      ?'PASS · Recorded model completed acceptance checks'
      :'FAIL · Model did not meet acceptance criteria'
    summary(model)
    showFrame(0)
    playbackTime=0
    playing=true
    $('play').textContent='Pause'
    lastTick=performance.now()
  }catch(e){
    if(generation===requestGeneration){
      $('mission-status').textContent='ERROR · '+String(e)
      console.error(e)
    }
  }finally{if(generation===requestGeneration)button.disabled=false}
}
const setScene=(next:MissionScene)=>{
  kind=next
  const m=metadata[kind]
  document.title=m.name+' | RealityLoop'
  $('mission-title').textContent=m.name
  $('mission-description').textContent=m.description
  $('model-limit').textContent=m.limit
  $('scene-tag').textContent=m.tag
  $('scene-name').textContent=m.name
  $<HTMLSelectElement>('mission-select').value=kind
  $('layout-controls').hidden=kind!=='satellite'
  $('terrain-controls').hidden=kind!=='mars'&&kind!=='construction'
  $('rover-candidate-controls').hidden=kind!=='mars'
  $<HTMLInputElement>('friction').value=kind==='mars'?'.78':'.66'
  $('friction-value').textContent=$<HTMLInputElement>('friction').value
  history.replaceState(null,'','?scene='+kind)
}
$<HTMLSelectElement>('mission-select').addEventListener('change',event=>{
  const next=(event.target as HTMLSelectElement).value as MissionScene
  setScene(next);void run()
})
$<HTMLSelectElement>('module-layout').addEventListener('change',()=>void run())
$<HTMLSelectElement>('rover-candidate').addEventListener('change',()=>void run())
$<HTMLInputElement>('friction').addEventListener('input',()=>{
  $('friction-value').textContent=$<HTMLInputElement>('friction').value
})
$('simulate').addEventListener('click',()=>void run())
$('play').addEventListener('click',()=>{
  playing=!playing
  $('play').textContent=playing?'Pause':'Play'
  lastTick=performance.now()
})
$<HTMLInputElement>('timeline').addEventListener('input',event=>{
  showFrame(Number((event.target as HTMLInputElement).value))
  playbackTime=frames[currentIndex]?.timeSeconds??0
  playing=false;$('play').textContent='Play'
})
const draw=(now:number)=>{
  const elapsed=Math.min(.25,(now-lastTick)/1000)
  lastTick=now
  if(playing&&frames.length>1){
    const speed=Number($<HTMLSelectElement>('playback-speed').value)
    const duration=frames.at(-1)!.timeSeconds
    playbackTime=Math.min(duration,playbackTime+elapsed*speed)
    let index=currentIndex
    while(index<frames.length-1&&frames[index+1].timeSeconds<=playbackTime)index++
    if(index!==currentIndex)showFrame(index)
    if(playbackTime>=duration){
      showFrame(frames.length-1)
      playing=false;$('play').textContent='Play'
    }
  }
  renderer.render(world.scene,world.camera)
  requestAnimationFrame(draw)
}
setScene(kind)
fit()
requestAnimationFrame(draw)
void run()
