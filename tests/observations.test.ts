import {strict as assert} from 'node:assert'
import {test} from 'node:test'
import {createSensorObservations} from '../src/observations.ts'

test('synthetic 3D LiDAR, IMU and odometry are pure derived observations',()=>{
  const trajectory=Object.freeze({
    observations:Object.freeze(Array.from({length:9},(_,i)=>Object.freeze({
      x:i*.08,z:0,yaw:0,speed:0.4,timeSeconds:i*.2,
    }))),
  })
  const observed=createSensorObservations(trajectory,0.5)
  assert.equal(observed.available,true)
  assert.equal(observed.frames.length,9)
  assert.ok(observed.lidar.length>=2)
  assert.ok(observed.lidar.every(sample=>sample.clouds.length===5))
  assert.ok(observed.lidar.flatMap(sample=>sample.clouds)
    .some(cloud=>cloud.points.length>0))
  assert.deepEqual(createSensorObservations(trajectory,0.5),observed)
  assert.equal(trajectory.observations.at(-1)?.x,.64)
  assert.ok(observed.frames[1]?.imu)
  assert.ok(observed.frames[1]?.encoder)
})
test('non-spatial cases have an explicit no-sensors result; rate is validated',()=>{
  const unavailable=createSensorObservations({observations:[{timeSeconds:0,channels:{v:1}}]})
  assert.equal(unavailable.available,false)
  assert.equal(unavailable.frames.length,0)
  assert.throws(()=>createSensorObservations({observations:[]},0))
  assert.throws(()=>createSensorObservations({observations:[]},-1))
})
