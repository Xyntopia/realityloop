import {strict as assert} from 'node:assert'
import {test} from 'node:test'
import {
  signedFootprintClearance,clearanceAtPose,checkSweptClearance,
} from '../src/clearance.ts'
import {supermarketObstacles} from '../src/geometry.ts'

test('reference-size oriented Tennant body clears or overlaps the southern shelf',()=>{
  const shelf=supermarketObstacles.find(o=>o.id==='shelf-s1')!
  const safe=signedFootprintClearance({x:2.1,z:2.1,yaw:0},shelf)
  const intersect=signedFootprintClearance({x:2.1,z:2.4,yaw:0},shelf)
  assert.ok(Math.abs(safe-(2.74-2.1-0.889/2))<1e-7)
  assert.ok(intersect<0)
  assert.ok(clearanceAtPose({x:0,z:0,yaw:0}).clearanceMetres>0)
})

test('swept footprint catches a shelf contact between collision-free endpoints',()=>{
  const a={x:2.1,z:2.1,yaw:0,timeSeconds:0}
  const b={x:2.1,z:2.1,yaw:Math.PI,timeSeconds:1}
  // Rotation of a rectangular body can touch shelf while endpoints are clear.
  const first=signedFootprintClearance(a,supermarketObstacles[3])
  const last=signedFootprintClearance(b,supermarketObstacles[3])
  const report=checkSweptClearance([a,b])
  assert.ok(first>0 && last>0)
  assert.ok(report.clearanceMetres<first)
  assert.ok(report.samplesChecked>10)
})
