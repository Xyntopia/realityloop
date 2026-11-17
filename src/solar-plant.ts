import {z} from 'zod'

/**
 * Deterministic PV + inverter + BESS educational plant simulation.
 *
 * Equipment envelope and local layout conventions are adapted from Joulios
 * feature/darden-study HybridPlantLayoutOptimizerNode / layout3dScene:
 * 12 × 4.5 m, 15 kW PV tables; 6 × 3 m, 2500 kW inverter skid;
 * 12.19 × 2.44 m, 1000 kW / 4000 kWh BESS; 30 × 20 m substation.
 *
 * This is a reduced-order clear-sky model, not SAM / PVsyst, an electrical
 * network solver, a geospatial validation or an as-built Darden study.
 */
export const solarPlantScenarioSchema=z.object({
  kind:z.literal('solar-plant'),
  name:z.string().min(1),
  sampleMinutes:z.number().int().min(5).max(60)
    .refine(minutes=>1440%minutes===0,'Sampling must divide 24 hours'),
  latitudeDegrees:z.number().min(-65).max(65),
  dayOfYear:z.number().int().min(1).max(365),
  tracker:z.enum(['tracking','fixed']),
  dcLossFraction:z.number().min(0).max(.3),
  ambientTemperatureC:z.number().min(-15).max(50),
  exportLimitKw:z.number().positive().max(3000),
  bessEnabled:z.boolean(),
}).strict()
export type SolarPlantScenario=z.infer<typeof solarPlantScenarioSchema>

export const solarEquipment=Object.freeze({
  rows:16,columns:12,
  tableWidthM:12,tableHeightM:4.5,tablePowerKw:15,
  tableXSpacingM:12.8,rowPitchM:8.4,
  inverterRatedKw:2500,inverterEfficiency:.975,
  bessPowerKw:1000,bessCapacityKwh:4000,
  bessRoundTripEfficiency:.90,
  substationWidthM:30,substationHeightM:20,
  inverterWidthM:6,inverterDepthM:3,
  bessWidthM:12.19,bessDepthM:2.44,
  maxTrackerTiltDegrees:55,
})
export type PvPlacement={id:string;x:number;z:number;row:number;column:number}
export type FacilityPlacement={
  id:string;kind:'inverter'|'bess'|'substation';x:number;z:number;
  width:number;depth:number
}
export const plantLayout=()=>{
  const c=solarEquipment
  const panels:Array<PvPlacement>=[]
  for(let row=0;row<c.rows;row++)for(let column=0;column<c.columns;column++)
    panels.push({
      id:`pv-${row}-${column}`,row,column,
      // True single-axis tracker: the 12 m length lies north–south (+Z),
      // with 4.5 m east–west chord (+X), rotating about the +Z torque tube.
      x:(row-(c.rows-1)/2)*c.rowPitchM,
      z:(column-(c.columns-1)/2)*c.tableXSpacingM-17,
    })
  const equipment:FacilityPlacement[]=[
    {id:'inv-a',kind:'inverter',x:-52,z:67,
      width:c.inverterWidthM,depth:c.inverterDepthM},
    {id:'bess-a',kind:'bess',x:3,z:72,
      width:c.bessWidthM,depth:c.bessDepthM},
    {id:'sub-a',kind:'substation',x:46,z:74,
      width:c.substationWidthM,depth:c.substationHeightM},
  ]
  return {pvTables:panels,equipment,accessRoadZ:58,
    dcNameplateKw:panels.length*c.tablePowerKw,
    acNameplateKw:c.inverterRatedKw}
}

export type SolarVector={x:number;y:number;z:number}
const toRad=Math.PI/180
const clamp=(v:number,low:number,high:number)=>Math.max(low,Math.min(high,v))
/** Solar position follows the standard declination/hour-angle approximation.
 * Local solar time is explicitly solar time, not a civil timestamp. */
export const solarPosition=(latitudeDegrees:number,dayOfYear:number,
  solarTimeHours:number)=>{
  const latitude=latitudeDegrees*toRad
  const declination=23.44*toRad*Math.sin(2*Math.PI*(284+dayOfYear)/365)
  const hourAngle=(solarTimeHours-12)*15*toRad
  const east=-Math.cos(declination)*Math.sin(hourAngle)
  const north=Math.cos(latitude)*Math.sin(declination)
    -Math.sin(latitude)*Math.cos(declination)*Math.cos(hourAngle)
  const up=Math.sin(latitude)*Math.sin(declination)
    +Math.cos(latitude)*Math.cos(declination)*Math.cos(hourAngle)
  const elevationDegrees=Math.asin(clamp(up,-1,1))/toRad
  const azimuthDegrees=(Math.atan2(east,north)/toRad+360)%360
  const sun:SolarVector={x:east,y:up,z:-north}
  return {elevationDegrees,azimuthDegrees,sun}
}

export const trackerAngle=(sun:SolarVector,tracker:'tracking'|'fixed')=>{
  if(tracker==='fixed')return 0 // Fixed horizontal baseline for comparison
  return clamp(Math.atan2(sun.x,Math.max(0,sun.y)),
    -solarEquipment.maxTrackerTiltDegrees*toRad,
    solarEquipment.maxTrackerTiltDegrees*toRad)
}
const irradiance=(sun:SolarVector,tilt:number)=>{
  if(sun.y<=0)return 0
  const dni=900*Math.pow(clamp(sun.y,0,1),.16)
  const dhi=110*Math.pow(clamp(sun.y,0,1),.8)
  const normal={x:Math.sin(tilt),y:Math.cos(tilt)}
  const beam=dni*Math.max(0,sun.x*normal.x+sun.y*normal.y)
  const sky=dhi*(1+Math.cos(tilt))/2
  const ground=(dni*sun.y+dhi)*.2*(1-Math.cos(tilt))/2
  return beam+sky+ground
}

export type SolarPlantSample={
  step:number;timeSeconds:number;solarHour:number
  sunElevationDegrees:number;sunAzimuthDegrees:number
  trackerTiltDegrees:number;irradianceWm2:number
  dcPowerKw:number;acAvailableKw:number;exportPowerKw:number
  bessPowerKw:number;bessSoc:number;curtailedKw:number
  cumulativeExportKwh:number;cumulativeCurtailmentKwh:number
}
export const runSolarPlantExperiment=(raw:unknown)=>{
  const s=solarPlantScenarioSchema.parse(raw)
  const l=plantLayout()
  const equipment=solarEquipment
  const intervalHours=s.sampleMinutes/60
  const dt=intervalHours
  const efficiency=Math.sqrt(equipment.bessRoundTripEfficiency)
  const observations:SolarPlantSample[]=[]
  const initialEnergyKwh=equipment.bessCapacityKwh*.22
  let stored=initialEnergyKwh,exportEnergy=0,curtailedEnergy=0,peakAcKw=0
  let maxDifference=0
  for(let step=0;step<=24*60/s.sampleMinutes;step++){
    const hour=step*dt
    const solar=solarPosition(s.latitudeDegrees,s.dayOfYear,hour)
    const tilt=trackerAngle(solar.sun,s.tracker)
    const poa=irradiance(solar.sun,tilt)
    const temperatureCellC=s.ambientTemperatureC+poa*.026
    const thermalFactor=clamp(1-.0035*(temperatureCellC-25),.5,1.3)
    // Shading is a compact GCR loss estimate; not a row-ray-tracing solve.
    const shadingLoss=s.tracker==='tracking'
      ?clamp((1-solar.sun.y)*.055,0,.055):.035
    const dcPowerKw=l.dcNameplateKw*(poa/1000)*thermalFactor
      *(1-s.dcLossFraction)*(1-shadingLoss)
    const acAvailableKw=Math.min(equipment.inverterRatedKw,
      dcPowerKw*equipment.inverterEfficiency)
    const surplus=Math.max(0,acAvailableKw-s.exportLimitKw)
    const potentialCharge=s.bessEnabled?Math.min(equipment.bessPowerKw,surplus,
      (equipment.bessCapacityKwh-stored)/(dt*efficiency)):0
    // Evening export is supported only by previously stored solar energy.
    const dispatchTargetKw=hour>=17&&hour<=22?250:0
    const potentialDischarge=s.bessEnabled?Math.min(equipment.bessPowerKw,
      Math.max(0,dispatchTargetKw-Math.min(acAvailableKw,s.exportLimitKw)),
      stored*efficiency/dt):0
    const bessPowerKw=potentialDischarge-potentialCharge
    const exportPowerKw=Math.min(s.exportLimitKw,
      acAvailableKw-potentialCharge+potentialDischarge)
    const curtailedKw=Math.max(0,acAvailableKw-potentialCharge
      +potentialDischarge-exportPowerKw)
    if(step<24*60/s.sampleMinutes){
      stored=clamp(stored+potentialCharge*dt*efficiency
        -potentialDischarge*dt/efficiency,0,equipment.bessCapacityKwh)
      exportEnergy+=exportPowerKw*dt
      curtailedEnergy+=curtailedKw*dt
    }
    peakAcKw=Math.max(peakAcKw,acAvailableKw)
    maxDifference=Math.max(maxDifference,
      Math.abs(acAvailableKw+bessPowerKw-exportPowerKw-curtailedKw))
    observations.push({
      step,timeSeconds:hour*3600,solarHour:hour,
      sunElevationDegrees:solar.elevationDegrees,
      sunAzimuthDegrees:solar.azimuthDegrees,
      trackerTiltDegrees:tilt/toRad,irradianceWm2:poa,
      dcPowerKw,acAvailableKw,exportPowerKw,
      bessPowerKw,bessSoc:stored/equipment.bessCapacityKwh,
      curtailedKw,
      cumulativeExportKwh:exportEnergy,
      cumulativeCurtailmentKwh:curtailedEnergy,
    })
  }
  const passed=observations.every(sample=>
    Number.isFinite(sample.dcPowerKw)&&sample.dcPowerKw>=0&&
    sample.exportPowerKw<=s.exportLimitKw+1e-8&&sample.exportPowerKw>=0&&
    sample.bessSoc>=0&&sample.bessSoc<=1)
    &&maxDifference<1e-7
  return {
    scenario:s,
    engine:{name:'clear-sky-pv-and-storage',
      model:'solar geometry + POA irradiance + DC derate + inverter cap + constrained BESS dispatch'},
    result:{
      passed,dcNameplateKw:l.dcNameplateKw,
      inverterAcNameplateKw:equipment.inverterRatedKw,
      bessCapacityKwh:s.bessEnabled?equipment.bessCapacityKwh:0,
      finalBessSoc:stored/equipment.bessCapacityKwh,
      totalExportKwh:exportEnergy,
      totalCurtailmentKwh:curtailedEnergy,
      peakAcKw,maxPowerBalanceErrorKw:maxDifference,
      pvTables:l.pvTables.length,
    },
    observations,
  }
}
export type SolarPlantResult=ReturnType<typeof runSolarPlantExperiment>
