import {strict as assert} from 'node:assert'
import {test} from 'node:test'
import {readFile} from 'node:fs/promises'
import {
  calculateSatelliteInertia,satelliteModules,runMissionExperiment,
  terrainHazards,terrainElevation,parseMissionScenario,
} from '../src/mission-experiments.ts'
import {createSensorObservations} from '../src/observations.ts'

test('satellite geometry reconstructs connected 40cm module configurations',()=>{
  const compact=satelliteModules('compact')
  const distributed=satelliteModules('distributed')
  const asymmetric=satelliteModules('asymmetric')
  assert.equal(compact.length,7)
  assert.equal(distributed.length,7)
  assert.equal(asymmetric.length,7)
  for(const arrangement of [compact,distributed,asymmetric]){
    const grid=new Set(arrangement.map(m=>[m.position.x,m.position.y,m.position.z]
      .map(x=>Math.round(x/.4)).join(',')))
    const visited=new Set<string>([grid.values().next().value!])
    let previous=0
    while(visited.size!==previous){
      previous=visited.size
      for(const position of visited){
        const [x,y,z]=position.split(',').map(Number)
        for(const [dx,dy,dz] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){
          const candidate=[x+dx,y+dy,z+dz].join(',')
          if(grid.has(candidate))visited.add(candidate)
        }
      }
    }
    assert.equal(visited.size,grid.size,'Each module must be face connected')
  }
})

test('reconfiguration changes full inertia tensor and pointing dynamics',()=>{
  const compact=calculateSatelliteInertia(satelliteModules('compact'))
  const asym=calculateSatelliteInertia(satelliteModules('asymmetric'))
  assert.deepEqual(compact.totalMassKg,asym.totalMassKg)
  assert.notDeepEqual(compact.inertia,asym.inertia)
  for(const layout of ['compact','distributed','asymmetric'] as const){
    const run=runMissionExperiment({
      kind:'satellite-adcs',name:'attitude',layout,
      durationSeconds:100,intervalSeconds:.05,torqueLimitNm:.3,
    })
    assert.equal(run.scenario.kind,'satellite-adcs')
    assert.equal(run.result.passed,true)
    if(!('finalErrorDegrees' in run.result))throw Error('Wrong result')
    assert(run.result.finalErrorDegrees<1)
    for(const o of run.observations){
      if(!('quaternion' in o))throw Error('Wrong observation')
      const q=o.quaternion
      assert(Math.abs(Math.hypot(q.x,q.y,q.z,q.w)-1)<1e-9)
      assert(o.wheelMomentumNms.every(h=>Math.abs(h)<8))
    }
    assert.equal(createSensorObservations(run).available,false,
      'Do not claim terrestrial LiDAR exists on satellite')
  }
})


test('Mars and construction route avoid hazards with correctly scoped sensors',()=>{
  for(const terrain of ['mars','construction'] as const){
    const run=runMissionExperiment({
      kind:'terrain-traverse',name:terrain,terrain,
      durationSeconds:terrain==='mars'?110:70,
      intervalSeconds:.05,frictionCoefficient:terrain==='mars' ? .78 : .66,
    })
    assert(run.result.passed,terrain+' route should reach goal')
    if(!('goalReached' in run.result))throw Error('Wrong result')
    assert(run.result.goalReached&&!run.result.unsafe)
    assert(run.result.minimumClearanceMetres>.05)
    assert.equal(run.result.gravityMetresPerSecondSquared,
      terrain==='mars'?3.71:9.81)
    assert.equal(createSensorObservations(run).available,false,
      'Existing supermarket LiDAR cannot be reused for another world')
    assert(terrainHazards(terrain).length>0)
    assert(Number.isFinite(terrainElevation(terrain,2,3)))
  }
})

test('Mars rover candidate mass and drive power affect the simulated traverse',()=>{
  const runs=['ares-rtg','helios-solar','pathfinder-light'] as const
  const results=runs.map(roverCandidate=>runMissionExperiment({
    kind:'terrain-traverse',name:'candidate-compare',terrain:'mars',
    roverCandidate,durationSeconds:110,intervalSeconds:.05,frictionCoefficient:.78,
  }))
  for(const run of results){
    assert(run.result.passed)
    if(!('roverMassKg' in run.result))throw Error('Wrong result')
    assert(run.result.roverMassKg!==null)
    assert(run.result.availableDrivePowerW!==null)
    assert(run.observations.length>20)
  }
  assert.notEqual(results[0].observations.at(-1)?.timeSeconds,
    results[1].observations.at(-1)?.timeSeconds)
})

test('scenario schema rejects unsupported physics and arbitrary keys',()=>{
  assert.throws(()=>parseMissionScenario({
    kind:'satellite-adcs',name:'invalid',layout:'compact',
    durationSeconds:100,intervalSeconds:.05,torqueLimitNm:.3,
    hackPhysics:'none',
  }))
  assert.throws(()=>parseMissionScenario({
    kind:'orbital-docking',name:'removed',durationSeconds:65,
    intervalSeconds:.05,thrusterLimitN:3,
  }))
})
