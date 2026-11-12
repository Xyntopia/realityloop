import RAPIER from '@dimforge/rapier3d-compat'
import { z } from 'zod'

/** A small, independently reproducible cleaning robot experiment, not a BrainOS interface. */
export const cleaningScenarioSchema = z.object({
  name: z.string().min(1),
  route: z.enum(['blocked', 'detour']),
  timestepSeconds: z.number().finite().positive().max(0.02),
  steps: z.number().int().positive().max(10_000),
  frictionCoefficient: z.number().finite().min(0.05).max(2),
  seed: z.number().int().nonnegative(),
}).strict()

export type CleaningScenario = z.infer<typeof cleaningScenarioSchema>
export const parseCleaningScenario = (value: unknown): CleaningScenario =>
  cleaningScenarioSchema.parse(value)

export type Obstacle = {
  id: string
  x: number
  z: number
  halfX: number
  halfZ: number
  height: number
  kind: 'shelf' | 'obstruction'
}

export const supermarketObstacles: readonly Obstacle[] = [
  { id: 'blocked-aisle', x: 4.35, z: 0, halfX: 0.45, halfZ: 1.27, height: 1.6, kind: 'obstruction' },
  { id: 'shelf-n1', x: 2.1, z: -3.2, halfX: 1.25, halfZ: 0.46, height: 2.1, kind: 'shelf' },
  { id: 'shelf-n2', x: 5.2, z: -3.2, halfX: 1.25, halfZ: 0.46, height: 2.1, kind: 'shelf' },
  { id: 'shelf-s1', x: 2.1, z: 3.2, halfX: 1.25, halfZ: 0.46, height: 2.1, kind: 'shelf' },
  { id: 'shelf-s2', x: 5.2, z: 3.2, halfX: 1.25, halfZ: 0.46, height: 2.1, kind: 'shelf' },
]

export type CleaningSample = {
  step: number
  timeSeconds: number
  x: number
  z: number
  yaw: number
  speed: number
  slipLeft: number
  slipRight: number
  cleanedAreaSqMetres: number
}

export type CleaningResult = {
  scenario: CleaningScenario
  engine: { name: 'rapier3d-compat'; version: '0.21.0'; model: 'regularized-wheel-traction-v1' }
  result: {
    passed: boolean
    goalReached: boolean
    goalDistanceMetres: number
    cleanedAreaSqMetres: number
    maximumAbsSlipMetresPerSecond: number
    stalledSeconds: number
  }
  observations: CleaningSample[]
}

const clamp = (v: number, low: number, high: number): number => Math.max(low, Math.min(high, v))
const angleDelta = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a))
const square = (v: number): number => v * v

const waypointsFor = (route: CleaningScenario['route']): ReadonlyArray<{ x: number; z: number }> =>
  route === 'blocked'
    ? [{ x: 7.5, z: 0 }]
    : [{ x: 2.15, z: 0 }, { x: 2.55, z: 2.15 }, { x: 5.55, z: 2.15 }, { x: 7.5, z: 0 }]

/**
 * Rapier currently owns planar rigid-body integration and collisions.
 * Wheel angular velocities and regularized longitudinal traction are integrated explicitly here,
 * mirroring the equations in modelica/DifferentialDriveSlip.mo until Rumoca linking is available.
 * This is an illustrative traction model; it does NOT model exact static friction or lateral tire slip.
 */
export const runCleaningScenario = async (scenario: CleaningScenario): Promise<CleaningResult> => {
  await RAPIER.init()
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 })
  try {
    const dt = scenario.timestepSeconds
    world.timestep = dt
    for (const item of supermarketObstacles) {
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(item.x, item.height / 2, item.z),
      )
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(item.halfX, item.height / 2, item.halfZ).setFriction(0.9),
        body,
      )
    }

    const mass = 55
    const wheelRadius = 0.12
    const halfTrack = 0.28
    const wheelInertia = 0.06
    const halfX = 0.37
    const halfZ = 0.31
    const height = 0.38
    const robot = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(0, height / 2, 0)
        .setLinearDamping(0.65)
        .setAngularDamping(1.1)
    )
    robot.setEnabledTranslations(true, false, true, true)
    robot.setEnabledRotations(false, true, false, true)
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(halfX, height / 2, halfZ)
        .setDensity(mass / (8 * halfX * (height / 2) * halfZ))
        .setFriction(0.85),
      robot,
    )

    const route = waypointsFor(scenario.route)
    let waypointIndex = 0
    let wheelL = 0
    let wheelR = 0
    let maxSlip = 0
    let stalledSeconds = 0
    let cleanedAreaSqMetres = 0
    const cleanedCells = new Set<string>()
    const cellSize = 0.18
    const observations: CleaningSample[] = []
    let goalReached = false
    let goalDistance = Infinity

    for (let step = 0; step < scenario.steps; step++) {
      const position = robot.translation()
      const q = robot.rotation()
      const yaw = 2 * Math.atan2(q.y, q.w)
      const vx = robot.linvel().x
      const vz = robot.linvel().z
      const yawRate = robot.angvel().y
      const forwardX = Math.cos(yaw)
      const forwardZ = -Math.sin(yaw)
      const sidewaysX = Math.sin(yaw)
      const sidewaysZ = Math.cos(yaw)
      const speed = forwardX * vx + forwardZ * vz
      const lateralSpeed = sidewaysX * vx + sidewaysZ * vz
      const target = route[waypointIndex]
      const distance = Math.hypot(target.x - position.x, target.z - position.z)
      if (distance < 0.38 && waypointIndex < route.length - 1) waypointIndex++
      const next = route[waypointIndex]
      const nextDistance = Math.hypot(next.x - position.x, next.z - position.z)
      const desiredYaw = Math.atan2(-(next.z - position.z), next.x - position.x)
      const headingError = angleDelta(desiredYaw - yaw)
      const turn = clamp(2.8 * headingError - 0.5 * yawRate, -1.9, 1.9)
      const desiredSpeed = Math.min(1.25, nextDistance * 1.5) *
        clamp(1 - Math.abs(headingError) / 2.0, 0.18, 1)
      const targetOmegaL = (desiredSpeed + halfTrack * turn) / wheelRadius
      const targetOmegaR = (desiredSpeed - halfTrack * turn) / wheelRadius
      const torqueL = clamp(1.5 * (targetOmegaL - wheelL), -8, 8)
      const torqueR = clamp(1.5 * (targetOmegaR - wheelR), -8, 8)

      // Positive yaw rotates the +x body axis toward -z in the chosen coordinates.
      const slipL = wheelRadius * wheelL - (speed + halfTrack * yawRate)
      const slipR = wheelRadius * wheelR - (speed - halfTrack * yawRate)
      const normalPerWheel = mass * 9.81 / 2
      const tractionL = scenario.frictionCoefficient * normalPerWheel * Math.tanh(slipL / 0.15)
      const tractionR = scenario.frictionCoefficient * normalPerWheel * Math.tanh(slipR / 0.15)
      wheelL += dt * (torqueL - wheelRadius * tractionL - 0.025 * wheelL) / wheelInertia
      wheelR += dt * (torqueR - wheelRadius * tractionR - 0.025 * wheelR) / wheelInertia

      // Forces at the wheel positions generate chassis translation and yaw.
      const applyWheel = (force: number, lateralOffset: number): void => {
        robot.applyImpulseAtPoint(
          { x: force * dt * forwardX, y: 0, z: force * dt * forwardZ },
          { x: position.x + sidewaysX * lateralOffset, y: height / 2,
            z: position.z + sidewaysZ * lateralOffset },
          true,
        )
      }
      applyWheel(tractionL, halfTrack)
      applyWheel(tractionR, -halfTrack)
      // Approximate resistance to sideways sliding; independently tune before fidelity claims.
      const lateralForce = -mass * 9.81 * scenario.frictionCoefficient *
        Math.tanh(lateralSpeed / 0.15)
      robot.applyImpulse({ x: dt * lateralForce * sidewaysX, y: 0,
        z: dt * lateralForce * sidewaysZ }, true)

      world.step()
      const now = robot.translation()
      const nowYaw = 2 * Math.atan2(robot.rotation().y, robot.rotation().w)
      goalDistance = Math.hypot(7.5 - now.x, now.z)
      if (goalDistance < 0.45) goalReached = true
      if (desiredSpeed > 0.6 && Math.hypot(robot.linvel().x, robot.linvel().z) < 0.07) {
        stalledSeconds += dt
      }
      maxSlip = Math.max(maxSlip, Math.abs(slipL), Math.abs(slipR))
      // A 2D footprint grid is the cleaning-coverage proxy (not a validated brush model).
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          const x = now.x + dx * cellSize
          const z = now.z + dz * cellSize
          if (x >= 0 && x <= 8 && Math.abs(z) <= 2.75 &&
              square(x - now.x) + square(z - now.z) <= square(0.32)) {
            cleanedCells.add(String(Math.floor(x / cellSize)) + ':' + String(Math.floor(z / cellSize)))
          }
        }
      }
      cleanedAreaSqMetres = cleanedCells.size * cellSize * cellSize
      if (step % 8 === 0 || step === scenario.steps - 1 || goalReached) {
        observations.push({
          step: step + 1,
          timeSeconds: (step + 1) * dt,
          x: now.x,
          z: now.z,
          yaw: nowYaw,
          speed: Math.hypot(robot.linvel().x, robot.linvel().z),
          slipLeft: slipL,
          slipRight: slipR,
          cleanedAreaSqMetres,
        })
      }
      if (goalReached) break
    }

    return {
      scenario,
      engine: { name: 'rapier3d-compat', version: '0.21.0', model: 'regularized-wheel-traction-v1' },
      result: {
        passed: goalReached,
        goalReached,
        goalDistanceMetres: goalDistance,
        cleanedAreaSqMetres,
        maximumAbsSlipMetresPerSecond: maxSlip,
        stalledSeconds,
      },
      observations,
    }
  } finally {
    world.free()
  }
}
