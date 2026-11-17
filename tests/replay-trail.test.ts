import {strict as assert} from 'node:assert'
import {test} from 'node:test'
import {createReplayTrail} from '../viewer/replay-trail.ts'

test('immutable replay trail preallocates and changes only draw range',()=>{
  const trail=createReplayTrail()
  const points=Array.from({length:401},(_,i)=>({x:i*.05,z:Math.sin(i*.01)}))
  trail.setObservations(points)
  const position=trail.geometry.getAttribute('position')
  assert.equal(position.count,401)
  assert.equal(trail.geometry.drawRange.count,0)
  trail.showThrough(1)
  assert.equal(trail.geometry.drawRange.count,2)
  trail.showThrough(400)
  assert.equal(trail.geometry.drawRange.count,401)
  trail.showThrough(10_000)
  assert.equal(trail.geometry.drawRange.count,401)
  assert.strictEqual(trail.geometry.getAttribute('position'),position)
  assert.ok(Math.abs(position.getX(400)-20)<1e-5)
  assert.ok(Math.abs(position.getZ(400)-Math.sin(4))<1e-5)
  trail.reset()
  assert.equal(trail.geometry.drawRange.count,0)
  trail.setObservations([{x:2,z:3}])
  trail.showThrough(0)
  assert.equal(trail.geometry.getAttribute('position').count,1)
  assert.equal(trail.geometry.drawRange.count,1)
  trail.geometry.dispose()
})
