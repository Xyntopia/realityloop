import * as THREE from 'three'
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js'
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js'
import {SSAOPass} from 'three/addons/postprocessing/SSAOPass.js'
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js'

export type AoMethod='ssao'|'gtao'

/** Both methods are optional GPU effects, never a dependency of the physics or
 * baseline renderer. Test harnesses may explicitly allow software GPU paths. */
export const useScreenSpaceAO=(
  requested:boolean,softwareRenderer:boolean,webgl2:boolean,
):boolean=>requested&&!softwareRenderer&&webgl2

type GtaoConstructor=typeof import('three/addons/postprocessing/GTAOPass.js').GTAOPass
type GtaoInstance=InstanceType<GtaoConstructor>

/** GTAO and SSAO share a presentation pipeline but only one AO pass is alive
 * at a time. GTAO is code-split; other presets do not fetch/compile it. */
export const createSupermarketPostFX=(
  renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera,
  softwareRenderer:boolean,{allowSoftwareForBenchmark=false}={},
)=>{
  let composer:EffectComposer|undefined
  let ao:SSAOPass|GtaoInstance|undefined
  let active:AoMethod|undefined
  let gtaoConstructor:GtaoConstructor|undefined
  let gtaoLoading:Promise<void>|undefined
  let requested:AoMethod='ssao'
  let enabled=false
  let disposed=false
  let canvasWidth=1,canvasHeight=1

  const disposePass=()=>{
    ao?.dispose()
    composer?.dispose()
    composer=undefined
    ao=undefined
    active=undefined
  }
  const resize=(width:number,height:number)=>{
    canvasWidth=width;canvasHeight=height
    if(!composer||!ao)return
    const ratio=renderer.getPixelRatio()
    composer.setPixelRatio(ratio)
    composer.setSize(width,height)
    // Half-res AO only; main color buffer stays at scene resolution.
    ao.setSize(Math.max(1,Math.floor(width*ratio*.5)),
      Math.max(1,Math.floor(height*ratio*.5)))
  }
  const switchPass=(method:AoMethod)=>{
    if(active===method)return
    disposePass()
    composer=new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene,camera))
    if(method==='gtao'&&gtaoConstructor){
      const pass=new gtaoConstructor(scene,camera,1,1)
      pass.updateGtaoMaterial({
        samples:8,radius:1.25,thickness:1.2,distanceFallOff:1,
        distanceExponent:1.2,scale:1.85,
      })
      pass.updatePdMaterial({samples:8,rings:2,radius:5})
      pass.blendIntensity=.88
      ao=pass
    }else{
      const pass=new SSAOPass(scene,camera,1,1,8)
      pass.kernelRadius=12
      pass.minDistance=.005
      pass.maxDistance=.16
      ao=pass
    }
    composer.addPass(ao)
    composer.addPass(new OutputPass())
    active=method
    resize(canvasWidth,canvasHeight)
  }
  const setQuality=(
    requestedAO:boolean,width:number,height:number,method:AoMethod='ssao',
  )=>{
    requested=method
    enabled=useScreenSpaceAO(
      requestedAO,softwareRenderer&&!allowSoftwareForBenchmark,
      renderer.capabilities.isWebGL2,
    )
    if(!enabled)return
    if(method==='gtao'&&!gtaoConstructor){
      switchPass('ssao') // graceful fallback while the module loads
      if(!gtaoLoading){
        gtaoLoading=import('three/addons/postprocessing/GTAOPass.js')
          .then(({GTAOPass})=>{
            if(disposed)return
            gtaoConstructor=GTAOPass
            if(enabled&&requested==='gtao')switchPass('gtao')
          })
          .catch(error=>{
            console.warn('GTAO unavailable; SSAO remains active',error)
          })
      }
    }else{
      switchPass(method)
    }
    resize(width,height)
  }
  return {
    setQuality,resize,
    getActiveMethod:():AoMethod|'off'=>enabled?active??'off':'off',
    render:()=>enabled&&composer?composer.render():renderer.render(scene,camera),
    dispose:()=>{disposed=true;disposePass()},
  }
}
