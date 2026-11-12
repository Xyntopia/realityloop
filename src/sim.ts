import RAPIER from '@dimforge/rapier3d-compat'
import type { Scenario } from './scenario.ts'

export type SimulationResult = {
  scenario: Scenario
  engine: { name: 'rapier3d-compat'; version: '0.21.0' }
  result: { passed: boolean; actualProgressMetres: number; minimumProgressMetres: number }
  observations: ReadonlyArray<{ step: number; x: number; y: number; z: number }>
}

/**
 * First executable smoke fixture: a dynamic box robot drives toward a static supermarket shelf.
 * This intentionally fails a progress assertion. No drive-train, sensor, SLAM or controller is
 * modeled here; those remain explicit 0.7.1 deliverables.
 */
export const runScenario = async (scenario: Scenario): Promise<SimulationResult> => {
  await RAPIER.init()
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
  try {
    world.timestep = scenario.timestepSeconds

    const floor = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(10, 0.1, 6).setTranslation(0, -0.1, 0).setFriction(0.85),
      floor,
    )
    const shelf = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(scenario.shelfXMetres, 0.8, 0),
    )
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.3, 0.8, 1.5), shelf)

    const robot = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 0.3, 0).setLinearDamping(0.02),
    )
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.4, 0.3, 0.5).setFriction(0.85),
      robot,
    )
    robot.applyImpulse({ x: scenario.impulseNewtonSeconds, y: 0, z: 0 }, true)

    const observations: Array<{ step: number; x: number; y: number; z: number }> = []
    let actualProgressMetres = 0
    for (let step = 0; step < scenario.steps; step++) {
      world.step()
      const pose = robot.translation()
      actualProgressMetres = Math.max(actualProgressMetres, pose.x)
      if (step % 10 === 0 || step === scenario.steps - 1) {
        observations.push({ step: step + 1, x: pose.x, y: pose.y, z: pose.z })
      }
    }
    return {
      scenario,
      engine: { name: 'rapier3d-compat', version: '0.21.0' },
      result: {
        passed: actualProgressMetres >= scenario.minimumProgressMetres,
        actualProgressMetres,
        minimumProgressMetres: scenario.minimumProgressMetres,
      },
      observations,
    }
  } finally {
    world.free()
  }
}
