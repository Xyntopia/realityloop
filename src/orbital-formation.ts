import type {ModelicaResult,ModelicaScenario} from './modelica/runtime.ts'
import type {OrbitalElements} from './orbital-elements.ts'
import {runSatelliteScenario,type Point3} from './mission-experiments.ts'
import {inspectFormation, type InspectionSnapshot} from './orbital-inspection.ts'

export type OrbitalState={
  timeSeconds:number
  chiefECI:Point3
  servicerECI:Point3
  relativeRTN:Point3
  chiefRadiusMetres:number
  separationMetres:number
  periodSeconds:number
  inspection?:InspectionSnapshot
}
export const orbitalModelicaScenario=(
  durationSeconds:number,intervalSeconds:number,
  orbitalElements?:OrbitalElements,
):ModelicaScenario=>({
  name:'keplerian-chief-servicer-formation',
  kind:'modelica',model:'KeplerFormation',durationSeconds,intervalSeconds,
  frictionCoefficient:.65,motorTorqueNewtonMetres:0,
  ...(orbitalElements?{orbitalElements}:{}),
})

const v=(x:number,y:number,z:number):Point3=>({x,y,z})
const subtract=(a:Point3,b:Point3)=>v(a.x-b.x,a.y-b.y,a.z-b.z)
const cross=(a:Point3,b:Point3)=>v(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x)
const dot=(a:Point3,b:Point3)=>a.x*b.x+a.y*b.y+a.z*b.z
const norm=(a:Point3)=>Math.sqrt(dot(a,a))
const normalize=(a:Point3)=>{const n=norm(a);if(n<1e-10)throw Error('Degenerate orbital frame');return v(a.x/n,a.y/n,a.z/n)}

/** Rotate chief-relative ECI displacement into RTN (radial, along-track,
 * orbit-normal) using chief analytic ECI velocity from Modelica. */
export const relativeRTN=(chief:Point3,velocity:Point3,servicer:Point3):Point3=>{
  const radial=normalize(chief)
  const normal=normalize(cross(chief,velocity))
  const along=cross(normal,radial)
  const delta=subtract(servicer,chief)
  return v(dot(delta,radial),dot(delta,along),dot(delta,normal))
}

type AdcsResult=ReturnType<typeof runSatelliteScenario>
/** Real Rumoca/Modelica orbit solution joined to the existing Euler/reaction
 * wheel ADCS at identical physical times. No fabricated orbit coordinates. */
export const joinSatelliteWithModelicaOrbit=(adcs:AdcsResult,model:ModelicaResult)=>{
  if(model.scenario.model!=='KeplerFormation')throw Error('Expected KeplerFormation Modelica result')
  const rows=model.observations
  if(rows.length!==adcs.observations.length)throw Error('Orbit/ADCS time grids differ')
  const read=(i:number,name:string):number=>{
    const value=rows[i]?.channels[name]
    if(!Number.isFinite(value))throw Error('Missing Modelica orbital output: '+name)
    return value!
  }
  const orbit:OrbitalState[]=rows.map((sample,i)=>{
    const expectedTime=adcs.observations[i]?.timeSeconds
    if(Math.abs(expectedTime-sample.timeSeconds)>1e-6)throw Error('Orbit/ADCS time mismatch at '+i)
    const chief=v(read(i,'tx'),read(i,'ty'),read(i,'tz'))
    const servicer=v(read(i,'sx'),read(i,'sy'),read(i,'sz'))
    const velocity=v(read(i,'tvx'),read(i,'tvy'),read(i,'tvz'))
    const rel=relativeRTN(chief,velocity,servicer)
    const separation=norm(subtract(servicer,chief))
    if(Math.abs(separation-read(i,'separation'))>1e-5)
      throw Error('Formation range disagrees with Modelica channels')
    return {
      timeSeconds:sample.timeSeconds,chiefECI:chief,servicerECI:servicer,
      relativeRTN:rel,chiefRadiusMetres:read(i,'targetRadius'),
      separationMetres:separation,periodSeconds:read(i,'orbitalPeriod'),
    }
  })
  const scan=inspectFormation(orbit,adcs.scenario.layout,
    adcs.observations.map(s=>s.quaternion))
  for(const [index,snapshot] of scan)orbit[index]!.inspection=snapshot
  const observations=adcs.observations.map((sample,i)=>({...sample,orbit:orbit[i]}))
  return {
    ...adcs,
    engine:{name:'rumoca-wasm + reduced-order-rigid-body',
      model:'KeplerFormation (two-body ECI) + Euler ADCS + planar scan ICP'},
    result:{...adcs.result,orbitalPeriodSeconds:orbit[0]!.periodSeconds,
      initialAltitudeMetres:orbit[0]!.chiefRadiusMetres-6378137,
      initialSeparationMetres:orbit[0]!.separationMetres,
      scanRegistrations:scan.filter(([,s])=>s.matches>=3).length},
    observations,
  }
}
