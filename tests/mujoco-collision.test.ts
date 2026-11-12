import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { createMujocoCollisionScene } from '../src/mujoco-collision.ts'
import { supermarketObstacles } from '../src/cleaning.ts'

test('official MuJoCo WASM detects each shelf without stepping physics', async () => {
  const scene = await createMujocoCollisionScene()
  try {
    assert.deepEqual(scene.query({x: 0, z: 0, yaw: 0}), [])
    for (const obstacle of supermarketObstacles) {
      const contacts = scene.query({x: obstacle.x, z: obstacle.z, yaw: 0})
      assert.ok(contacts.some(c =>
        c.obstacleId === obstacle.id && c.penetrationMetres > 0), obstacle.id)
    }
  } finally { scene.close() }
})

test('MuJoCo reports penetration and obstacle-outward contact normal', async () => {
  const scene = await createMujocoCollisionScene()
  try {
    const c = scene.query({x: 3.8, z: 0, yaw: 0})
      .find(c => c.obstacleId === 'blocked-aisle')
    assert.ok(c)
    assert.ok(c.penetrationMetres > 0.3)
    assert.ok(c.normalX < -0.95)
    assert.ok(Math.abs(c.normalZ) < 0.05)
    assert.equal(c.penetrationMetres, -c.distanceMetres)
    assert.deepEqual(scene.query({x: 3.8, z: 0, yaw: 0}),
      scene.query({x: 3.8, z: 0, yaw: 0}))
  } finally { scene.close() }
  assert.throws(() => scene.query({x: 3.8, z: 0, yaw: 0}))
})
