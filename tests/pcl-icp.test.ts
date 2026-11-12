import { strict as assert } from 'node:assert'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import type * as PCL from 'pcl.js'
import { registerPointScans } from '../src/pcl-icp.ts'

const require = createRequire(import.meta.url)
// The published pcl.js Node ESM entrypoint assumes __dirname; use its supported CJS entry.
const pcl: typeof PCL = require('pcl.js') as typeof PCL

test('external PCL ICP recovers planar rotation and translation in WASM', async () => {
  await pcl.init()
  const pointCloud = Array.from({ length: 90 }, (_, i) => {
    const angle = i * 2.399963229728653
    const radius = 1.2 + i * 0.017
    return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius }
  })
  const shift = { x: 0.11, z: -0.06, yaw: 0.025 }
  const current = pointCloud.map(({ x, z }) => ({
    x: Math.cos(shift.yaw) * x - Math.sin(shift.yaw) * z - shift.x,
    z: Math.sin(shift.yaw) * x + Math.cos(shift.yaw) * z - shift.z,
  }))
  const match = registerPointScans(pcl, current, pointCloud)
  assert.equal(match.converged, true)
  assert.ok(match.rmsErrorMetres < 0.04, JSON.stringify(match))
  assert.ok(Math.abs(match.dx - shift.x) < 0.03, JSON.stringify(match))
  assert.ok(Math.abs(match.dz - shift.z) < 0.03, JSON.stringify(match))
})
