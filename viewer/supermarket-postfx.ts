import * as THREE from 'three'
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js'
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js'
import {SSAOPass} from 'three/addons/postprocessing/SSAOPass.js'
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js'
import {type VisualQuality} from './render-policy.ts'

/** Screen-space AO is deliberately a High/GPU-only option: the normal/depth
 * render costs more than a few contact decals. Balanced uses those decals,
 * Performance stays unprocessed, and software renderers never run SSAO. */
export const useScreenSpaceAO=(
  quality:VisualQuality,softwareRenderer:boolean,webgl2:boolean,
):boolean=>quality==='high'&&!softwareRenderer&&webgl2

export const createSupermarketPostFX=(
  renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera,
  softwareRenderer:boolean,
)=>{
  let composer:EffectComposer|undefined
  let ao:SSAOPass|undefined
  let enabled=false
  const resize=(width:number,height:number)=>{
    if(!composer||!ao)return
    const ratio=renderer.getPixelRatio()
    composer.setPixelRatio(ratio)
    composer.setSize(width,height)
    // Half-res 8-tap SSAO; composite against the full-resolution color pass.
    ao.setSize(Math.max(1,Math.floor(width*ratio*.5)),
      Math.max(1,Math.floor(height*ratio*.5)))
  }
  const setQuality=(quality:VisualQuality,width:number,height:number)=>{
    enabled=useScreenSpaceAO(
      quality,softwareRenderer,renderer.capabilities.isWebGL2,
    )
    if(!enabled)return
    if(!composer){
      composer=new EffectComposer(renderer)
      composer.addPass(new RenderPass(scene,camera))
      ao=new SSAOPass(scene,camera,1,1,8)
      ao.kernelRadius=9
      ao.minDistance=.008
      ao.maxDistance=.115
      composer.addPass(ao)
      composer.addPass(new OutputPass())
    }
    resize(width,height)
  }
  return {
    setQuality,resize,
    render:()=>enabled&&composer?composer.render():renderer.render(scene,camera),
    dispose:()=>{composer?.dispose();composer=undefined;ao=undefined},
  }
}
