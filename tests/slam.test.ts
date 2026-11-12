import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { beamEnd, lidars, OccupancyGrid, scanLidars, SlamTracker } from '../src/slam.ts'

test('LiDAR layout includes one front and two units on each side', () => {
  assert.equal(lidars.length, 5)
  assert.equal(lidars.filter(s => s.side === 'front').length, 1)
  assert.equal(lidars.filter(s => s.side === 'left').length, 2)
  assert.equal(lidars.filter(s => s.side === 'right').length, 2)
  assert.equal(new Set(lidars.map(s => s.id)).size, 5)
})

test('front sensor detects the obstructing box, side sensors detect nearby shelves', () => {
  const pose = { x: 0, z: 0, yaw: 0 }
  const scans = scanLidars(pose)
  const front = scans[0]
  const center = front.rays[(front.rays.length - 1) / 2]
  assert.equal(center.hit, true)
  assert.ok(Math.abs(center.range - 3.15) < 0.08)
  const end = beamEnd(pose, front.sensor, center)
  assert.ok(Math.abs(end.x - 3.9) < 0.08)
  assert.ok(scans.some(s => s.sensor.side !== 'front' && s.rays.some(r => r.hit)))
})

test('occupancy grid records free and occupied cells using simulated scans', () => {
  const map = new OccupancyGrid()
  const truth = { x: 0, z: 0, yaw: 0 }
  for (let i = 0; i < 5; i++) map.integrate(truth, scanLidars(truth))
  const counts = map.counts()
  assert.ok(counts.freeCells > 20)
  assert.ok(counts.occupiedCells > 5)
  assert.ok(map.get(3.9, 0) > 0)
})

test('scan matching plus odometry is deterministic and bounded for a fixed trace', () => {
  const truth = Array.from({ length: 25 }, (_, i) => ({
    x: i * 0.075, z: i * 0.01, yaw: i * 0.002,
  }))
  const trace = () => {
    const slam = new SlamTracker()
    const frames = truth.map(pose => slam.step(pose))
    return { frames: frames.map(f => ({ pose: f.pose, count: f.occupiedCells })),
      map: Array.from(slam.grid.logOdds) }
  }
  const a = trace()
  const b = trace()
  assert.deepEqual(a, b)
  assert.ok(a.frames.at(-1)!.count > 0)
  assert.ok(Number.isFinite(a.frames.at(-1)!.pose.x))
})
