import {test} from 'node:test'
import {strict as assert} from 'node:assert'
import {
  solarEquipment,plantLayout,solarPosition,trackerAngle,
  runSolarPlantExperiment,solarPlantScenarioSchema,
} from '../src/solar-plant.ts'
import {createSensorObservations} from '../src/observations.ts'
import {runExperiment} from '../src/experiment.ts'

const config={
  kind:'solar-plant' as const,name:'solar-acceptance',
  sampleMinutes:10,latitudeDegrees:35.5,dayOfYear:172,
  tracker:'tracking' as const,dcLossFraction:.045,
  ambientTemperatureC:30,exportLimitKw:1800,bessEnabled:true,
}

test('Joulios-compatible layout keeps clear row pitch and equipment envelopes',()=>{
  const layout=plantLayout()
  assert.equal(layout.pvTables.length,solarEquipment.rows*solarEquipment.columns)
  assert.equal(layout.dcNameplateKw,2880)
  assert.equal(layout.acNameplateKw,2500)
  assert.equal(new Set(layout.pvTables.map(p=>p.id)).size,layout.pvTables.length)
  for(const [a,b] of layout.pvTables.slice(1).map((p,i)=>
    [layout.pvTables[i],p] as const)){
    if(a.row===b.row)assert(Math.abs(b.z-a.z)>=solarEquipment.tableWidthM)
  }
  assert(solarEquipment.rowPitchM>solarEquipment.tableHeightM)
  const row0=layout.pvTables.find(p=>p.row===0&&p.column===0)!
  const row1=layout.pvTables.find(p=>p.row===1&&p.column===0)!
  assert(Math.abs(row1.x-row0.x-solarEquipment.rowPitchM)<1e-9)
  assert.deepEqual(layout.equipment.map(e=>e.kind),['inverter','bess','substation'])
})

test('sun position and tracker controller have physically consistent conventions',()=>{
  const morning=solarPosition(35.5,172,8)
  const noon=solarPosition(35.5,172,12)
  const evening=solarPosition(35.5,172,16)
  assert(morning.sun.x>0&&evening.sun.x<0)
  assert(noon.sun.y>.9)
  assert(Math.abs(noon.sun.x)<1e-10)
  assert(trackerAngle(morning.sun,'tracking')>0)
  assert(trackerAngle(evening.sun,'tracking')<0)
  assert.equal(trackerAngle(noon.sun,'fixed'),0)
})

test('day simulation has finite bounded PV, battery, export and deterministic energy totals',()=>{
  const first=runSolarPlantExperiment(config)
  const second=runSolarPlantExperiment(config)
  assert.deepEqual(first,second)
  const {result,observations}=first
  assert(result.passed)
  assert.equal(observations.length,145)
  assert(result.totalExportKwh>10000)
  assert(result.peakAcKw>1500)
  assert.equal(result.pvTables,192)
  assert(result.maxPowerBalanceErrorKw<1e-7)
  assert(observations.some(f=>f.bessPowerKw<0),'battery must charge')
  assert(observations.some(f=>f.bessPowerKw>0),'battery must discharge')
  for(const frame of observations){
    assert(frame.dcPowerKw>=0&&Number.isFinite(frame.dcPowerKw))
    assert(frame.exportPowerKw<=config.exportLimitKw+1e-9)
    assert(frame.exportPowerKw>=0)
    assert(frame.bessSoc>=0&&frame.bessSoc<=1)
    assert(Math.abs(frame.acAvailableKw+frame.bessPowerKw
      -frame.exportPowerKw-frame.curtailedKw)<1e-8)
  }
  assert.equal(createSensorObservations(first).available,false,
    'PV generation does not imply supermarket robot LiDAR')
})

test('tracker mode and grid export limit change electrical observations',()=>{
  const tracked=runSolarPlantExperiment({...config,bessEnabled:false})
  const fixed=runSolarPlantExperiment({...config,tracker:'fixed',bessEnabled:false})
  assert(tracked.result.totalExportKwh>fixed.result.totalExportKwh,
    'single-axis tracking must increase daily production over horizontal fixed')
  const constrained=runSolarPlantExperiment({...config,exportLimitKw:950,
    bessEnabled:false})
  assert(constrained.result.totalCurtailmentKwh>fixed.result.totalCurtailmentKwh)
  assert(constrained.observations.every(f=>f.exportPowerKw<=950+1e-8))
  const disabled=runSolarPlantExperiment({...config,bessEnabled:false})
  assert(disabled.observations.every(f=>f.bessPowerKw===0))
})

test('scenario rejects invalid configuration and routes through CLI dispatcher',async()=>{
  assert.throws(()=>solarPlantScenarioSchema.parse({...config,sampleMinutes:7}))
  assert.throws(()=>solarPlantScenarioSchema.parse({...config,unknown:123}))
  const result=await runExperiment(config)
  assert.equal(result.scenario.name,config.name)
  assert(result.result.passed)
})
