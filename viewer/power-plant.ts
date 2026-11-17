import * as THREE from 'three'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'
import {runBrowserDag} from '../src/dag-browser.ts'
import {
  runSolarPlantExperiment,
  type SolarPlantSample,type SolarPlantResult,type SolarPlantScenario,
} from '../src/solar-plant.ts'
import {createSolarPlantWorld} from './power-plant-scene.ts'
import {isSoftwareRenderer} from './renderer-capabilities.ts'

const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'})
const software=isSoftwareRenderer(renderer)
renderer.setPixelRatio(Math.min(devicePixelRatio,software ? .62 : 1.15))
renderer.shadowMap.enabled=!software
renderer.shadowMap.type=THREE.PCFSoftShadowMap
renderer.outputColorSpace=THREE.SRGBColorSpace
renderer.toneMapping=THREE.ACESFilmicToneMapping
renderer.toneMappingExposure=1.05
renderer.domElement.setAttribute('aria-label','3D model of a solar PV plant with inverters and BESS')
$<HTMLDivElement>('viewport').append(renderer.domElement)
const makeScenario=():SolarPlantScenario=>({
  kind:'solar-plant',
  name:'utility-scale-solar-clear-sky-day',
  sampleMinutes:10,latitudeDegrees:35.5,dayOfYear:172,
  tracker:$<HTMLSelectElement>('tracker-mode').value as 'tracking'|'fixed',
  dcLossFraction:.045,
  ambientTemperatureC:Number($<HTMLInputElement>('ambient-temp').value),
  exportLimitKw:Number($<HTMLInputElement>('export-limit').value),
  bessEnabled:$<HTMLInputElement>('storage-enabled').checked,
})
let scenario=makeScenario()
const world=createSolarPlantWorld(renderer,scenario)
const camera=world.camera
const controls=new OrbitControls(camera,renderer.domElement)
const cameraPreset=(mode:string)=>{
  if(mode==='overview'){
    camera.position.set(82,48,110)
    controls.target.set(-6,3,-9)
  }else if(mode==='yard'){
    camera.position.set(5,14,108)
    controls.target.set(14,3,64)
  }else{
    camera.position.set(-86,21,102)
    controls.target.set(28,3,-22)
  }
  controls.update()
}
cameraPreset($<HTMLSelectElement>('view-mode').value)
controls.enableDamping=true
controls.dampingFactor=.08
controls.maxPolarAngle=Math.PI/2-.045
controls.maxDistance=400
controls.minDistance=8
controls.update()
let timeline:SolarPlantSample[]=[]
let frameIndex=72,playing=true
let lastTime=performance.now(),playAccum=0
const formatClock=(hour:number)=>{
  const minutes=Math.round(hour*60)
  return String(Math.floor(minutes/60)).padStart(2,'0')+':'
    +String(minutes%60).padStart(2,'0')
}
const readout=(id:string,text:string)=>{$(id).textContent=text}
const kw=(value:number)=>Math.round(value).toLocaleString('en-US')+' kW'
const drawChart=()=>{
  const canvas=$<HTMLCanvasElement>('telemetry')
  const ctx=canvas.getContext('2d')
  if(!ctx||timeline.length===0)return
  const w=canvas.width,h=canvas.height
  ctx.clearRect(0,0,w,h)
  ctx.fillStyle='#172639';ctx.fillRect(0,0,w,h)
  const left=34,right=w-10,top=13,bottom=h-23
  const x=(i:number)=>left+i/Math.max(1,timeline.length-1)*(right-left)
  const maxP=Math.max(...timeline.map(f=>f.acAvailableKw),
    scenario.exportLimitKw,1)*1.07
  const yP=(p:number)=>bottom-p/maxP*(bottom-top)
  for(let i=0;i<=3;i++){
    const y=bottom-i/3*(bottom-top)
    ctx.strokeStyle='#3d4c5f';ctx.lineWidth=1
    ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke()
  }
  const line=(value:(f:SolarPlantSample)=>number,
    color:string,scale:(x:number)=>number)=>{
    ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=2
    for(let i=0;i<timeline.length;i++){
      const y=scale(value(timeline[i]))
      if(i===0)ctx.moveTo(x(i),y);else ctx.lineTo(x(i),y)
    }
    ctx.stroke()
  }
  line(f=>f.acAvailableKw,'#7ca9da',yP)
  line(f=>f.exportPowerKw,'#f78f3b',yP)
  line(f=>f.bessSoc,'#93cda8',f=>bottom-f*(bottom-top))
  ctx.strokeStyle='rgba(255,255,255,.7)';ctx.lineWidth=1
  ctx.beginPath();ctx.moveTo(x(frameIndex),top);ctx.lineTo(x(frameIndex),bottom);ctx.stroke()
  ctx.font='11px system-ui'
  ctx.fillStyle='#9baebf'
  ctx.fillText('0',left-16,bottom+3)
  ctx.fillText('kW',3,top+2)
  for(const hour of [0,6,12,18,24])
    ctx.fillText(String(hour).padStart(2,'0')+':00',
      left+(right-left)*hour/24-13,h-6)
}
const applyFrame=(i:number)=>{
  if(timeline.length===0)return
  frameIndex=Math.max(0,Math.min(timeline.length-1,Math.trunc(i)))
  const sample=timeline[frameIndex]
  world.update(sample)
  $<HTMLInputElement>('timeline').value=String(frameIndex)
  readout('time-label',formatClock(sample.solarHour))
  readout('metric-a',kw(sample.exportPowerKw))
  readout('metric-b',kw(sample.dcPowerKw))
  readout('metric-c',(sample.bessSoc*100).toFixed(1)+'%')
  drawChart()
}
const run=async()=>{
  const button=$<HTMLButtonElement>('simulate')
  button.disabled=true
  readout('mission-status','Calculating deterministic PV/BESS model…')
  try{
    scenario=makeScenario()
    const executed=await runBrowserDag(scenario,
      {model:'realityloop-solar-plant-v1',electrical:'reduced-order',
        geometry:'joulios-darden-table-envelope-v1'},
      scenario=>runSolarPlantExperiment(scenario)) as {
        result:SolarPlantResult;artifactHash:string
      }
    const result=executed.result
    timeline=result.observations
    $<HTMLInputElement>('timeline').max=String(timeline.length-1)
    const metrics=result.result
    readout('mission-status',metrics.passed
      ?'PASS · Power limits and energy balance verified'
      :'FAIL · Power limits or energy balance violated')
    readout('metric-d',(metrics.totalExportKwh/1000).toFixed(2)+' MWh')
    readout('plant-summary',metrics.pvTables+' PV tables · '
      +(metrics.dcNameplateKw/1000).toFixed(2)+' MWdc · '
      +(metrics.inverterAcNameplateKw/1000).toFixed(2)+' MWac')
    readout('model-summary',result.engine.model)
    readout('artifact-id',executed.artifactHash.slice(0,26)+'…')
    applyFrame(Math.min(frameIndex,timeline.length-1))
  }catch(error){
    readout('mission-status','ERROR · '+String(error))
    console.error(error)
  }finally{button.disabled=false}
}
const resize=()=>{
  const node=$<HTMLElement>('viewport')
  const width=Math.max(1,node.clientWidth),height=Math.max(1,node.clientHeight)
  renderer.setSize(width,height,false)
  camera.aspect=width/height
  camera.updateProjectionMatrix()
}
new ResizeObserver(resize).observe($('viewport'))
window.addEventListener('resize',resize)
for(const id of ['export-limit','ambient-temp']){
  $<HTMLInputElement>(id).addEventListener('input',()=>{
    readout(id+'-value',id==='export-limit'
      ?Number($<HTMLInputElement>(id).value).toLocaleString('en-US')+' kW'
      :$<HTMLInputElement>(id).value+'°C')
  })
}
$<HTMLSelectElement>('view-mode').addEventListener('change',event=>
  cameraPreset((event.target as HTMLSelectElement).value))
$('simulate').addEventListener('click',()=>void run())
for(const id of ['tracker-mode','storage-enabled'])
  $(id).addEventListener('change',()=>void run())
$<HTMLInputElement>('timeline').addEventListener('input',event=>{
  playing=false;readout('play','Play')
  applyFrame(Number((event.target as HTMLInputElement).value))
})
$('play').addEventListener('click',()=>{
  playing=!playing;readout('play',playing?'Pause':'Play')
})
const draw=(now:number)=>{
  const elapsed=Math.min((now-lastTime)/1000,.25)
  lastTime=now
  if(playing&&timeline.length>1){
    const speed=Number($<HTMLSelectElement>('playback-speed').value)
    // Three seconds per simulated hour at 1×; the counter controls only
    // visualization playback, not numerical time stepping.
    playAccum+=elapsed*speed/3
    if(playAccum>=1){
      const next=frameIndex+Math.floor(playAccum)
      playAccum%=1
      if(next>=timeline.length){playing=false;readout('play','Play')}
      applyFrame(Math.min(next,timeline.length-1))
    }
  }
  controls.update()
  renderer.render(world.scene,camera)
  requestAnimationFrame(draw)
}
resize()
requestAnimationFrame(draw)
void run()
