import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { sampleRobotSensors, scanLidar3D, sensorMounts } from '../src/sensors.ts'

test('five 3D LiDAR heads return finite xyz points at multiple elevations', () => {
  const clouds = scanLidar3D({x:0,z:0,yaw:0}, 1.5)
  assert.equal(clouds.length, 5)
  const points = clouds.flatMap(cloud => cloud.points)
  assert.ok(points.length > 100)
  assert.ok(new Set(points.map(p => p.y.toFixed(2))).size > 5)
  assert.ok(points.every(p =>
    [p.x,p.y,p.z,p.range,p.intensity].every(Number.isFinite)))
  assert.ok(clouds.every(c => c.stampSeconds === 1.5 && c.totalBeams > c.points.length))
  assert.deepEqual(scanLidar3D({x:0,z:0,yaw:0}, 1.5), clouds)
})

test('front/rear RGB, depth, IMU and wheel encoder frames have explicit timing and frames', () => {
  assert.equal(sensorMounts.filter(s => s.kind === 'rgb-camera').length, 2)
  assert.equal(sensorMounts.filter(s => s.kind === 'depth-camera').length, 1)
  assert.equal(sensorMounts.filter(s => s.kind === 'imu').length, 1)
  assert.equal(sensorMounts.filter(s => s.kind === 'wheel-encoder').length, 1)
  const before = sampleRobotSensors({x:0,z:0,yaw:0},0.5,0)
  const after = sampleRobotSensors({x:.1,z:-.02,yaw:.05},0.5,.2,
    {pose:{x:0,z:0,yaw:0},speed:0.5,stampSeconds:0})
  assert.equal(after.cameras.length, 3)
  assert.ok(after.imu.angularVelocityRadiansPerSecond.y > 0)
  assert.ok(after.encoder.ticks > 0)
  assert.ok(after.cameras.every(c => !c.imageAvailable &&
    c.frameId !== after.imu.frameId && c.stampSeconds===0.2))
  assert.equal(before.imu.angularVelocityRadiansPerSecond.y,0)
})
