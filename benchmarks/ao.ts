import * as THREE from 'three'
import {createSupermarketInterior} from '../viewer/supermarket-interior.ts'
import {createSupermarketPostFX,type AoMethod} from '../viewer/supermarket-postfx.ts'
import {presetGraphicsEffects} from '../viewer/graphics-settings.ts'
import {createTennantT7AMR} from '../viewer/tennant.ts'

const width=560,height=315
const renderer=new THREE.WebGLRenderer({
  antialias:false,powerPreference:'low-power',preserveDrawingBuffer:true,
})
renderer.setSize(width,height)
renderer.setPixelRatio(.7)
renderer.outputColorSpace=THREE.SRGBColorSpace
renderer.toneMapping=THREE.ACESFilmicToneMapping
renderer.toneMappingExposure=.99
renderer.shadowMap.enabled=false
document.body.append(renderer.domElement)

const scene=new THREE.Scene()
const camera=new THREE.PerspectiveCamera(65,width/height,.1,90)
camera.position.set(-2.35,1.68,-.1)
camera.lookAt(6.9,1.55,-.1)
const interior=createSupermarketInterior(scene,renderer)
interior.setVisualQuality('balanced',{
  ...presetGraphicsEffects('balanced'),
  castShadows:false,ambientOcclusion:true,
})
const robot=createTennantT7AMR()
robot.position.set(1.8,0,.25)
scene.add(robot)

// Test-only explicit opt-in for software WebGL. The production renderer
// unconditionally rejects SSAO/GTAO on software GPU implementations.
const postFX=createSupermarketPostFX(renderer,scene,camera,true,{
  allowSoftwareForBenchmark:true,
})
const waitUntilActive=async(method:AoMethod)=>{
  const deadline=performance.now()+20000
  while(postFX.getActiveMethod()!==method){
    if(performance.now()>deadline)throw Error('AO pass not ready: '+method)
    await new Promise(resolve=>setTimeout(resolve,40))
  }
}
const measure=async(method:'off'|AoMethod)=>{
  postFX.setQuality(method!=='off',width,height,
    method==='off'?'ssao':method)
  if(method!=='off')await waitUntilActive(method)
  // Shader compilation is excluded from timing. We still report GPU/software
  // synchronous completion with gl.finish() to avoid measuring JS submission.
  postFX.render()
  renderer.getContext().finish()
  const samples:number[]=[]
  for(let i=0;i<2;i++){
    const started=performance.now()
    postFX.render()
    renderer.getContext().finish()
    samples.push(performance.now()-started)
  }
  const timing=samples.sort((a,b)=>a-b)[Math.floor(samples.length/2)]!
  return {method,frameMs:Math.round(timing*10)/10,
    viewport:[width,height],pixelRatio:renderer.getPixelRatio(),
    draws:renderer.info.render.calls,active:postFX.getActiveMethod()}
}
Object.assign(window,{__realityloopAOTest:{measure,renderer:renderer.info}})
