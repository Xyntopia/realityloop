import {strict as assert} from 'node:assert'
import {test} from 'node:test'
import {fileURLToPath} from 'node:url'
import {runModelicaScenario} from '../src/modelica/node.ts'
import {orbitalModelicaScenario,joinSatelliteWithModelicaOrbit,relativeRTN}
  from '../src/orbital-formation.ts'
import {
  runSatelliteScenario,satelliteModules,calculateSatelliteInertia,
  parseMissionScenario,
} from '../src/mission-experiments.ts'
import {registerPlanarScan,rotateIntoSatelliteBody} from '../src/orbital-inspection.ts'
import {satelliteProjectedBoxes,solarWingDimensions}
  from '../src/satellite-scan-geometry.ts'
import {createSensorObservations} from '../src/observations.ts'
import {defaultOrbitalElements} from '../src/orbital-elements.ts'

const directory=fileURLToPath(new URL('../',import.meta.url))
const near=(x:number,y:number,limit:number)=>assert(
  Math.abs(x-y)<limit,`Expected ${x} ~= ${y} (tol ${limit})`)

test('KeplerFormation is genuinely compiled by Rumoca and propagates two orbital-element spacecraft',async()=>{
  const dt=.1,seconds=12
  const model=await runModelicaScenario(orbitalModelicaScenario(seconds,dt),directory)
  assert.equal(model.engine.name,'rumoca-wasm')
  assert.equal(model.observations.length,121)
  const p=model.observations
  const start=p[0]!.channels,finish=p.at(-1)!.channels
  assert(model.channelNames.includes('eccentricAnomaly'))
  assert(model.channelNames.includes('servicerEccentricAnomaly'))
  for(const entry of p){
    const c=entry.channels
    const radius=Math.hypot(c.tx,c.ty,c.tz)
    const separation=Math.hypot(c.sx-c.tx,c.sy-c.ty,c.sz-c.tz)
    near(radius,c.targetRadius,1e-4)
    near(separation,c.separation,1e-5)
    assert(separation>3&&separation<20,'formation separations must be physically bounded')
    // Two-body Kepler radius from solved eccentric anomaly.
    const a=6878137,e=.0011
    near(radius,a*(1-e*Math.cos(c.eccentricAnomaly)),1e-3)
    near(c.meanAnomaly-c.servicerMeanAnomaly,-1.2e-6,1e-10)
    // Kepler's specific mechanical energy and angular momentum must be
    // conserved independently of observation sampling cadence.
    const mu=3.986004418e14
    for(const [prefix,eccentricity] of [
      ['t',.0011],['s',.0011007],
    ] as const){
      const r=[c[prefix+'x'],c[prefix+'y'],c[prefix+'z']]
      const v=[c[prefix+'vx'],c[prefix+'vy'],c[prefix+'vz']]
      const rr=Math.hypot(...r),vv=Math.hypot(...v)
      const specificEnergy=vv*vv/2-mu/rr
      near(specificEnergy,-mu/(2*a),1e-3)
      const h=Math.hypot(r[1]*v[2]-r[2]*v[1],
        r[2]*v[0]-r[0]*v[2],r[0]*v[1]-r[1]*v[0])
      near(h,Math.sqrt(mu*a*(1-eccentricity*eccentricity)),.1)
    }
  }
  assert(finish.meanAnomaly>start.meanAnomaly)
  near(start.orbitalPeriod,5676.978,1)
})

test('Orbital elements are validated and override the actual Modelica propagation',async()=>{
  const elements={
    ...defaultOrbitalElements,
    semiMajorAxis:defaultOrbitalElements.semiMajorAxis+150_000,
    inclination:.5,
    raan:.7,
  }
  const baseline=await runModelicaScenario(orbitalModelicaScenario(2,.1),directory)
  const changed=await runModelicaScenario(
    orbitalModelicaScenario(2,.1,elements),directory)
  const chief=changed.observations[0]!.channels
  near(chief.targetRadius,elements.semiMajorAxis*
    (1-elements.eccentricity*Math.cos(chief.eccentricAnomaly)),1e-3)
  assert(chief.orbitalPeriod>baseline.observations[0]!.channels.orbitalPeriod)
  assert(Math.abs(chief.tx-baseline.observations[0]!.channels.tx)>1e5)
  assert.throws(()=>parseMissionScenario({
    kind:'satellite-adcs',name:'invalid',layout:'compact',
    durationSeconds:5,intervalSeconds:.1,torqueLimitNm:.3,
    orbitalElements:{...elements,eccentricity:1.05},
  }),/eccentricity|Too big/)
  assert.throws(()=>parseMissionScenario({
    kind:'satellite-adcs',name:'invalid',layout:'compact',
    durationSeconds:5,intervalSeconds:.1,torqueLimitNm:.3,
    orbitalElements:{...elements,extraCartesianPosition:[7e6,0,0]},
  }),/Unrecognized|unrecognized/)
})

test('Modelica orbital formation joins exact ADCS times and records independent planar range scans',async()=>{
  const scenario={
    kind:'satellite-adcs' as const,name:'orbit-inspection',layout:'compact' as const,
    durationSeconds:12,intervalSeconds:.1,torqueLimitNm:.3,
    orbitalModel:'KeplerFormation' as const,
  }
  const model=await runModelicaScenario(orbitalModelicaScenario(12,.1),directory)
  const result=joinSatelliteWithModelicaOrbit(runSatelliteScenario(scenario),model)
  assert.equal(result.result.passed,runSatelliteScenario(scenario).result.passed,
    'Adding orbital physics must not override the independent ADCS acceptance result')
  const rows=result.observations
  assert.equal(rows.length,121)
  const snapshots=rows.map(x=>x.orbit.inspection).filter(x=>x!==undefined)
  assert(snapshots.length>=6)
  assert(result.result.scanRegistrations>=3)
  const sensed=createSensorObservations(result)
  assert.equal(sensed.available,true)
  assert.equal(sensed.orbitalInspection?.kind,'synthetic-planar-range-icp')
  assert.equal(sensed.orbitalInspection?.scans.length,snapshots.length)
  assert.equal(sensed.frames.length,0,
    'Do not silently reuse terrestrial supermarket sensor frames in orbit')
  assert(snapshots.at(-1)!.mapPoints.length>15)
  assert(snapshots.at(-1)!.rmsMetres!<.15)
  for(const sample of rows){
    const orbit=sample.orbit
    near(sample.timeSeconds,orbit.timeSeconds,1e-8)
    near(
      Math.hypot(orbit.relativeRTN.x,orbit.relativeRTN.y,orbit.relativeRTN.z),
      orbit.separationMetres,1e-3,
    )
  }
  const f=rows[0]!.orbit
  assert(Math.abs(f.chiefECI.x)>1e6)
  assert(f.chiefRadiusMetres>6.7e6)
})

test('RTN frame is orthonormal and differentiates radial, along-track, cross-track',()=>{
  const chief={x:7e6,y:0,z:0}
  const speed={x:0,y:7400,z:0}
  assert.deepEqual(relativeRTN(chief,speed,{x:7e6+2,y:3,z:4}),{
    x:2,y:3,z:4,
  })
})

test('Satellite projected scan geometry shares panel centers with the renderer',()=>{
  for(const layout of ['compact','distributed','asymmetric'] as const){
    const modules=satelliteModules(layout)
    const com=calculateSatelliteInertia(modules).centerOfMass
    const panels=solarWingDimensions(modules,com)
    const silhouette=satelliteProjectedBoxes(layout)
    assert.equal(silhouette.length,modules.length+2)
    assert.deepEqual(silhouette.slice(-2),panels.map(p=>p.projectedBox))
    for(const panel of panels){
      near((panel.projectedBox.xmin+panel.projectedBox.xmax)/2,
        panel.direction*(panel.extent+.28),1e-10)
      near(panel.projectedBox.xmax-panel.projectedBox.xmin,1.65,1e-10)
    }
  }
})

test('Scanner transforms RTN position through the full 3D body quaternion',()=>{
  const point={x:2,y:3,z:4}
  assert.deepEqual(rotateIntoSatelliteBody(point,{x:0,y:0,z:0,w:1}),point)
  const a=Math.PI/4
  const transformed=rotateIntoSatelliteBody(point,{
    x:0,y:Math.sin(a),z:0,w:Math.cos(a),
  })
  near(transformed.x,-4,1e-10)
  near(transformed.y,3,1e-10)
  near(transformed.z,2,1e-10)
  assert.throws(()=>rotateIntoSatelliteBody(point,{x:0,y:0,z:0,w:0}),
    /Degenerate satellite quaternion/)
})

test('ICP can correct a noisy 2D odometric prior on asymmetric scans',()=>{
  const reference=[
    {x:0,y:0},{x:1,y:0},{x:2,y:.2},{x:2.1,y:1.1},
    {x:1.4,y:1.5},{x:.8,y:1.2},{x:.2,y:.9},
  ]
  const initial={x:.065,y:-.045,yaw:.04}
  const match=registerPlanarScan(reference,reference,initial)
  assert(match.matches>=6)
  assert(match.rmsMetres!==null&&match.rmsMetres<1e-4)
  assert(Math.hypot(match.pose.x,match.pose.y)<.01)
  assert(Math.abs(match.pose.yaw)<.01)
})
