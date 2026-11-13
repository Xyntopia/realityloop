export type VisualQuality='high'|'balanced'|'performance'

export type AutoQualityState=Readonly<{
  quality:VisualQuality
  slowWindows:number
  fastWindows:number
}>

/** Conservative hysteresis: two slow windows drop a tier; four comfortably
 * fast windows recover one. Called once per visible FPS sampling window. */
export const updateAutoQuality=(
  state:AutoQualityState,fps:number,
):AutoQualityState=>{
  if(fps<24){
    const slow=state.slowWindows+1
    if(slow>=2)return {
      quality:state.quality==='high'?'balanced':'performance',
      slowWindows:0,fastWindows:0,
    }
    return {...state,slowWindows:slow,fastWindows:0}
  }
  if(fps>=55){
    const fast=state.fastWindows+1
    if(fast>=4)return {
      quality:state.quality==='performance'?'balanced':'high',
      slowWindows:0,fastWindows:0,
    }
    return {...state,slowWindows:0,fastWindows:fast}
  }
  return {...state,slowWindows:0,fastWindows:0}
}

type SensorPreviewFrame=Readonly<{
  now:number
  lastCapture:number
  quality:VisualQuality
  panelsVisible:boolean
  pageVisible:boolean
}>

/** A separate WebGL context is costly even when its canvas is hidden.
 *  This gates only the *display* preview; DAG sensor artifacts are unaffected. */
export const shouldCaptureSensorPreview=({
  now,lastCapture,quality,panelsVisible,pageVisible,
}:SensorPreviewFrame):boolean=>{
  if(!pageVisible||!panelsVisible)return false
  const interval=quality==='high'?150:quality==='balanced'?350:900
  return now-lastCapture>=interval
}
