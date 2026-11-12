import type { ModelicaResult, ModelicaScenario } from './runtime.ts'
import { parseModelicaScenario } from './runtime.ts'

export type SupermarketRoute = 'blocked' | 'detour'

export const supermarketModelicaScenario = (
  route: SupermarketRoute,
  muStatic = 0.72,
): ModelicaScenario => parseModelicaScenario({
  kind: 'modelica',
  name: 'realityloop-supermarket-modelica-' + route,
  model: route === 'detour'
    ? 'RealityLoopContacts.SupermarketRobot'
    : 'RealityLoopContacts.SupermarketBlocked',
  durationSeconds: 20,
  intervalSeconds: 0.05,
  frictionCoefficient: muStatic,
  motorTorqueNewtonMetres: 135,
})

export type SupermarketReplaySample = {
  step: number
  timeSeconds: number
  x: number
  z: number
  yaw: number
  speed: number
  steerAngle: number
  driveWheelSlip: number
  lateralSlip: number
  cleanedAreaSqMetres: number
  contactMode?: number
  contactLoad?: number
}
export type SupermarketReplay = {
  scenario: { name: string; route: SupermarketRoute; timestepSeconds: number; steps: number }
  engine: { name: 'rumoca-wasm'; version: string; commit: string; model: string }
  result: {
    passed: boolean
    goalReached: boolean
    goalDistanceMetres: number
    cleanedAreaSqMetres: number
    maximumAbsSlipMetresPerSecond: number
    stalledSeconds: number
    maximumPenetrationMetres: number
    maximumContactForceNewtons: number
  }
  observations: SupermarketReplaySample[]
}

/**
 * Converts an actual compiler-produced trajectory into the UI/CI replay contract.
 * Never integrates, re-solves or overrides the Modelica state.
 * Floor coverage is a post-processed, sampled footprint proxy.
 */
export const toSupermarketReplay = (model: ModelicaResult): SupermarketReplay => {
  if (!['RealityLoopContacts.SupermarketRobot', 'RealityLoopContacts.SupermarketBlocked'].includes(
    model.scenario.model,
  )) throw Error('Not a RealityLoop Modelica supermarket scenario')

  const route: SupermarketRoute =
    model.scenario.model === 'RealityLoopContacts.SupermarketRobot' ? 'detour' : 'blocked'
  const cells = new Set<string>()
  const resolution = 0.16
  let goalReached = false
  let stalledSeconds = 0
  let maxSlip = 0
  let maxPenetration = 0
  let maxContactForce = 0
  // Stop playback on first arrival, not after the solver continues past the goal.
  const arrival = model.observations.findIndex(o =>
    Math.hypot(7.5 - o.channels.x, o.channels.z) < 0.55)
  const relevant = arrival >= 0 ? model.observations.slice(0, arrival + 1) : model.observations
  const observations = relevant.map(({ timeSeconds, channels }, i): SupermarketReplaySample => {
    const { x, z, yaw, v, steer, slipSpeed, contactMode, contactLoad,
      collisionDepth, collisionForce } = channels
    if (![x, z, yaw, v, steer, slipSpeed, contactMode, contactLoad,
      collisionDepth, collisionForce].every(Number.isFinite)) {
      throw Error('Modelica supermarket trajectory is missing mandatory physics channels')
    }
    const distanceToGoal = Math.hypot(7.5 - x, z)
    if (distanceToGoal < 0.55) goalReached = true
    if (Math.abs(v) < 0.07 && x > 1 && !goalReached) {
      stalledSeconds += Math.max(0, timeSeconds - (model.observations[i - 1]?.timeSeconds ?? timeSeconds))
    }
    maxSlip = Math.max(maxSlip, Math.abs(slipSpeed))
    maxPenetration = Math.max(maxPenetration, collisionDepth)
    maxContactForce = Math.max(maxContactForce, collisionForce)
    // Same conceptual 0.65m cleaning width as the Rapier prototype; not a brush model.
    for (let j = -2; j <= 2; j++) {
      const px = x + j * 0.13 * Math.sin(yaw)
      const pz = z + j * 0.13 * Math.cos(yaw)
      if (px >= 0 && px <= 8 && Math.abs(pz) <= 2.7) {
        cells.add(Math.floor(px / resolution) + ':' + Math.floor(pz / resolution))
      }
    }
    return {
      step: i + 1,
      timeSeconds, x, z, yaw,
      speed: Math.abs(v),
      steerAngle: steer,
      driveWheelSlip: slipSpeed,
      lateralSlip: 0, // Lateral tire slip not represented by this Modelica plant.
      cleanedAreaSqMetres: cells.size * resolution ** 2,
      contactMode,
      contactLoad,
    }
  })
  const last = observations.at(-1)
  if (!last) throw Error('No Modelica supermarket observations')
  return {
    scenario: {
      name: model.scenario.name,
      route,
      timestepSeconds: model.scenario.intervalSeconds,
      steps: model.observations.length,
    },
    engine: {
      name: 'rumoca-wasm',
      version: model.engine.version,
      commit: model.engine.commit,
      model: model.scenario.model,
    },
    result: {
      passed: goalReached,
      goalReached,
      goalDistanceMetres: Math.hypot(7.5 - last.x, last.z),
      cleanedAreaSqMetres: last.cleanedAreaSqMetres,
      maximumAbsSlipMetresPerSecond: maxSlip,
      stalledSeconds,
      maximumPenetrationMetres: maxPenetration,
      maximumContactForceNewtons: maxContactForce,
    },
    observations,
  }
}
