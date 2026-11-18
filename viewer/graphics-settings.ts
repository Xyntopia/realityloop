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
  castShadows:requested.lighting&&requested.castShadows,
  ambientOcclusion:requested.ambientOcclusion&&ssaoSupported,
})

/** High renders a real shadow map per luminaire. Balanced keeps a sparse,
 * spatially distributed subset; software/Performance stay deliberately cheap. */
export const ceilingShadowBudget=(
  quality:VisualQuality,enabled:boolean,fixtureCount:number,softwareRenderer=false,
):number=>enabled&&!softwareRenderer
  ? Math.min(fixtureCount,quality==='high'?fixtureCount:
    quality==='balanced'?7:1) : 0

/** Avoid stacking baked AO, fake shelf contact blobs and real lamp shadows.
 * This affects the floor's visual presentation, never physical geometry. */
export const floorShadingProfile=(
  quality:VisualQuality,effects:GraphicsEffects,realShadowsAvailable=true,
):Readonly<{bakedAO:number;fixtureContactOpacity:number;wallSeamOpacity:number}>=>{
  const dynamic=realShadowsAvailable&&effects.lighting&&effects.castShadows
  return {
    bakedAO:quality==='performance' ? 0 : dynamic
      ? (quality==='high' ? .12 : .25) : .44,
    fixtureContactOpacity:!effects.contactShadows ? 0 : dynamic
      ? (quality==='high' ? 0 : .14) : .32,
    wallSeamOpacity:!effects.contactShadows ? 0 : dynamic ? .28 : .4,
  }
}

export const enabledEffectCount=(effects:GraphicsEffects):number=>
  graphicsEffects.filter(key=>effects[key]).length
