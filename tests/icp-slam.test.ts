import { strict as assert } from 'node:assert'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import type * as PCL from 'pcl.js'
import { PclIcpSlamTracker } from '../src/icp-slam.ts'

const require = createRequire(import.meta.url)
const pcl: typeof PCL = require('pcl.js') as typeof PCL

test('PCL ICP-based SLAM estimates pose and builds occupancy using external registration', async () => {
  await pcl.init()
  const frames = Array.from({ length: 12 }, (_, i) => ({
    pose: { x: i * 0.075, z: 0, yaw: 0 }, speed: 0.30, stampSeconds: i * 0.25,
  }))
  const run = () => {
    const slam = new PclIcpSlamTracker(pcl)
    const history = frames.map(frame =>
      slam.step(frame.pose, frame.speed, frame.stampSeconds))
    return history.map(s => ({
      pose: s.pose, accepted: s.acceptedMatches, occupied: s.occupiedCells,
    }))
  }
  const a = run()
  const b = run()
  assert.deepEqual(a,b)
  assert.ok(a.at(-1)!.occupied > 0)
  assert.ok(a.at(-1)!.pose.x > 0.1)
  assert.ok(a.at(-1)!.accepted > 0, 'At least one external ICP registration must be accepted')
})
