import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { supermarketObstacles } from '../src/cleaning.ts'
import type { TennantResult, TennantScenario } from '../src/tennant.ts'
import type { SupermarketReplay } from '../src/modelica/supermarket.ts'
import { createTennantT7AMR } from './tennant.ts'
import { SlamView } from './slam-view.ts'
import './style.css'

const elem = (id:string) => {
  const node=document.getElementById(id)
  if(!node)throw Error('Missing element '+id)
  return node
}
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x101e24)
scene.fog = new THREE.FogExp2(0x101e24,0.012)
const camera = new THREE.PerspectiveCamera(43,innerWidth/innerHeight,0.1,90)
camera.position.set(12,10,14)
const renderer = new THREE.WebGLRenderer({antialias:true, powerPreference:'high-performance'})
renderer.setSize(innerWidth,innerHeight)
renderer.setPixelRatio(Math.min(devicePixelRatio,2))
renderer.shadowMap.enabled=true
renderer.shadowMap.type=THREE.PCFSoftShadowMap
renderer.outputColorSpace=THREE.SRGBColorSpace
renderer.toneMapping=THREE.ACESFilmicToneMapping
renderer.toneMappingExposure=1.48
elem('scene').append(renderer.domElement)
const controls = new OrbitControls(camera,renderer.domElement)
controls.target.set(4,0,0)
controls.enableDamping=true
controls.maxPolarAngle=Math.PI*0.46
controls.update()

scene.add(new THREE.HemisphereLight(0xdff4ff,0x17292f,2.6))
const sun = new THREE.DirectionalLight(0xf7eacb,3.2)
sun.position.set(5,13,8)
sun.castShadow=true
sun.shadow.mapSize.set(2048,2048)
sun.shadow.camera.left=-15;sun.shadow.camera.right=15
sun.shadow.camera.top=15;sun.shadow.camera.bottom=-15
sun.shadow.bias=-0.00025
scene.add(sun)
const floor = new THREE.Mesh(new THREE.PlaneGeometry(36,26),new THREE.MeshStandardMaterial({color:0x607278,roughness:0.89,metalness:0.04}))
floor.rotation.x=-Math.PI/2
floor.receiveShadow=true
scene.add(floor)
const floorGrid = new THREE.GridHelper(26,52,0x81989a,0x70888a)
floorGrid.position.set(4,0.006,0)
;(floorGrid.material as THREE.Material).transparent=true
;(floorGrid.material as THREE.Material).opacity=0.14
scene.add(floorGrid)
const mat=(color:number,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness:0.75,metalness})
const shelfSide=mat(0x4f6971,0.4),shelfTop=mat(0x8fa3a4,0.4)
const goods=[mat(0x8caa9c),mat(0xd9a565),mat(0xac8387),mat(0x678eaa),mat(0xc2b890)]
const obstructionMat=mat(0xc6715f,0.15)
const addBox=(w:number,h:number,d:number,x:number,y:number,z:number,material:THREE.Material,parent:THREE.Object3D=scene)=>{
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material)
  m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m
}
for(const o of supermarketObstacles){
  const group=new THREE.Group();group.position.set(o.x,0,o.z);scene.add(group)
  if(o.kind==='obstruction'){
    addBox(o.halfX*2,o.height,o.halfZ*2,0,o.height/2,0,obstructionMat,group)
    for(let level=0;level<3;level++){
      addBox(o.halfX*2+0.05,0.045,o.halfZ*2+0.05,0,0.35+level*0.5,0,shelfTop,group)
    }
  }else{
    for(const zz of [-o.halfZ,o.halfZ])for(const xx of [-o.halfX,o.halfX]){
      addBox(0.045,o.height,0.045,xx,o.height/2,zz,shelfSide,group)
    }
    for(let level=0;level<5;level++){
      const y=0.25+level*0.40
      addBox(o.halfX*2,0.055,o.halfZ*2,0,y,0,shelfTop,group)
      for(let k=0;k<9;k++)for(const zz of [-0.24,0.24]){
        const m=goods[(k+level*2+(zz>0?1:0))%goods.length]
        addBox(0.17,0.24,0.24,-o.halfX+0.19+k*0.265,y+0.145,zz,m,group)
      }
    }
  }
}
const goal = new THREE.Mesh(new THREE.RingGeometry(0.43,0.51,48),new THREE.MeshBasicMaterial({color:0x3ce0b7,side:THREE.DoubleSide}))
goal.rotation.x=-Math.PI/2;goal.position.set(7.5,0.016,0);scene.add(goal)
const robot=createTennantT7AMR()
scene.add(robot)
const slamView=new SlamView(elem('slam-map') as HTMLCanvasElement,scene)
const trailGeometry=new THREE.BufferGeometry()
const trailMaterial=new THREE.LineBasicMaterial({color:0xf3c16a,transparent:true,opacity:0.95})
const trail=new THREE.Line(trailGeometry,trailMaterial)
scene.add(trail)
const coverageGeometry=new THREE.PlaneGeometry(0.22,0.22)
const coverageMaterial=new THREE.MeshBasicMaterial({color:0x38bea8,transparent:true,opacity:0.17,depthWrite:false,side:THREE.DoubleSide})
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
      : await import('../src/tennant.ts').then(m=>m.runTennantScenario(
          m.parseTennantScenario({...base,route,name:'tennant-t7amr-'+route})))
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
      setStatus(result.result.passed?'COMPLETE · GOAL REACHED':'FAILED · ROUTE BLOCKED')
    }
  }
  controls.update()
  renderer.render(scene,camera)
  if(now-lastCameraRender>150){slamView.renderCamera(robot,scene);lastCameraRender=now}
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
let topView=false
elem('camera').addEventListener('click',()=>{
  topView=!topView
  if(topView){camera.position.set(4.4,17,0.1);controls.target.set(4,0,0)}
  else{camera.position.set(12,10,14);controls.target.set(4,0,0)}
  controls.update()
  elem('camera').textContent=topView?'Perspective':'Top view'
})
addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth,innerHeight)
})
void slamView.enablePclIcp()
void run('detour')
requestAnimationFrame(render)
