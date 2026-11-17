import type {VisualQuality} from './render-policy.ts'

/** Rendering presentation only: never affects physics, obstacle geometry or sensors. */
export type GraphicsEffect =
  'lighting'|'glare'|'contactShadows'|'ambientOcclusion'|
  'reflections'|'surfaceDetail'|'castShadows'
export const graphicsEffects:readonly GraphicsEffect[]=[
  'lighting','glare','contactShadows','ambientOcclusion',
  'reflections','surfaceDetail','castShadows',
]
export type GraphicsEffects=Readonly<Record<GraphicsEffect,boolean>>
export type GraphicsPreset='auto'|'high'|'balanced'|'performance'|'custom'

/** The three quality presets match the existing renderer tiers. A custom
 * configuration retains independent effects and its own render detail tier. */
export const presetGraphicsEffects=(quality:VisualQuality):GraphicsEffects=>{
  const high=quality==='high'
  const low=quality==='performance'
  return {
    lighting:!low,
    glare:!low,
    contactShadows:!low,
    ambientOcclusion:high,
    reflections:!low,
    surfaceDetail:!low,
    castShadows:!low,
  }
}

export const resolveGraphicsEffects=(
  requested:GraphicsEffects,ssaoSupported:boolean,
):GraphicsEffects=>({
  ...requested,
  // A lamp cannot glare when its emissive surface and lights are disabled.
  glare:requested.lighting&&requested.glare,
  ambientOcclusion:requested.ambientOcclusion&&ssaoSupported,
})

export const enabledEffectCount=(effects:GraphicsEffects):number=>
  graphicsEffects.filter(key=>effects[key]).length
