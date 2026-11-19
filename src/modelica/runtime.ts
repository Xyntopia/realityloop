import initRumoca, { get_git_commit, get_version, simulate_model, wasm_init } from '@taskyon/rumoca'
import { z } from 'zod'
import {orbitalElementsSchema} from '../orbital-elements.ts'

export const modelicaScenarioSchema = z.object({
  name: z.string().min(1),
  kind: z.literal('modelica'),
  model: z.enum([
    'RealityLoopContacts.TennantStickSlip',
    'RealityLoopContacts.WheelBench',
    'RealityLoopContacts.SupermarketRobot',
    'RealityLoopContacts.SupermarketBlocked',
    'RealityLoopContacts.SupermarketShelfProbe',
    'RealityLoopContacts.SupermarketMeshRobot',
    'RealityLoopContacts.SupermarketMeshBlocked',
    'RealityLoopContacts.SupermarketExternalRobot',
    'RealityLoopContacts.SupermarketExternalBlocked',
    'RealityLoopMeshContacts.MeshContactProbe',
    'RealityLoopMeshContacts.ImportedSolidProbe',
    'RealityLoopMeshContacts.ImportedContactDynamics',
    'RealityLoopMeshContacts.ImportedBvhParityProbe',
    'RealityLoopProviders.DefaultProbe',
    'RealityLoopProviders.AlternateProbe',
    'TennantFrontSteerSlip',
    'DifferentialDriveSlip',
    'KeplerFormation',
  ]),
  durationSeconds: z.number().finite().positive().max(200),
  intervalSeconds: z.number().finite().min(0.005).max(0.2),
  frictionCoefficient: z.number().finite().min(0.05).max(1.5),
  motorTorqueNewtonMetres: z.number().finite().min(-600).max(600),
  orbitalElements:orbitalElementsSchema.optional(),
  collisionBackend:z.enum(['rapier','mujoco']).optional(),
}).strict().refine(s=>
  s.model.startsWith('RealityLoopContacts.SupermarketExternal')
    ?s.collisionBackend!==undefined:s.collisionBackend===undefined, {
  message:'Collision backend is required only for the external Modelica supermarket',
}).refine(s => s.model==='KeplerFormation'||!s.orbitalElements, {
  message:'Orbital elements are only supported by KeplerFormation',
}).refine(s => s.model === 'KeplerFormation' || s.durationSeconds <= 20, {
  message: 'Non-orbital Modelica examples are limited to 20 seconds',
}).refine(s => s.durationSeconds / s.intervalSeconds <= 2000, {
  message: 'Modelica experiment exceeds the 2000-interval observation limit',
}).refine(s => ![
  'RealityLoopContacts.SupermarketRobot','RealityLoopContacts.SupermarketBlocked',
  'RealityLoopContacts.SupermarketMeshRobot','RealityLoopContacts.SupermarketMeshBlocked',
  'RealityLoopContacts.SupermarketExternalRobot','RealityLoopContacts.SupermarketExternalBlocked',
].includes(s.model) || s.motorTorqueNewtonMetres > 0, {
  message: 'Supermarket motorLimit must be positive',
})
export type ModelicaScenario = z.infer<typeof modelicaScenarioSchema>
export const parseModelicaScenario = (value: unknown): ModelicaScenario =>
  modelicaScenarioSchema.parse(value)

export type ModelicaSample = { timeSeconds: number; channels: Readonly<Record<string, number>> }
export type ModelicaResult = {
  scenario: ModelicaScenario
  engine: { name: 'rumoca-wasm'; version: string; commit: string; solver: 'auto' }
  result: { passed: true; points: number; finalTimeSeconds: number }
  observations: ModelicaSample[]
  channelNames: string[]
}

/** A stable source-file name for a strict allowlist of published local model examples. */
export const modelicaSourceFile = (model: ModelicaScenario['model']): string =>
  model.startsWith('RealityLoopContacts.') ? 'RealityLoopContacts.mo'
    : model.startsWith('RealityLoopMeshContacts.') ? 'RealityLoopMeshContacts.mo'
      : model.startsWith('RealityLoopProviders.') ? 'RealityLoopProviders.mo'
        : model + '.mo'

const makeOverrides = (scenario: ModelicaScenario): Record<string, number> => {
  switch (scenario.model) {
    case 'RealityLoopContacts.SupermarketRobot':
    case 'RealityLoopContacts.SupermarketBlocked':
    case 'RealityLoopContacts.SupermarketShelfProbe':
    case 'RealityLoopContacts.SupermarketMeshRobot':
    case 'RealityLoopContacts.SupermarketMeshBlocked':
    case 'RealityLoopContacts.SupermarketExternalRobot':
    case 'RealityLoopContacts.SupermarketExternalBlocked':
      return { muStatic: scenario.frictionCoefficient, motorLimit: scenario.motorTorqueNewtonMetres }
    case 'RealityLoopContacts.TennantStickSlip':
      return { muStatic: scenario.frictionCoefficient, motorTorque: scenario.motorTorqueNewtonMetres }
    case 'RealityLoopContacts.WheelBench':
      return { muStatic: scenario.frictionCoefficient, driveTorque: scenario.motorTorqueNewtonMetres }
    case 'TennantFrontSteerSlip':
      return { mu: scenario.frictionCoefficient, motorTorque: scenario.motorTorqueNewtonMetres }
    case 'DifferentialDriveSlip':
      return { mu: scenario.frictionCoefficient, torqueLeft: scenario.motorTorqueNewtonMetres,
        torqueRight: scenario.motorTorqueNewtonMetres }
    case 'KeplerFormation':
      return scenario.orbitalElements ? {...scenario.orbitalElements} : {}
    case 'RealityLoopMeshContacts.MeshContactProbe':
    case 'RealityLoopMeshContacts.ImportedSolidProbe':
    case 'RealityLoopMeshContacts.ImportedContactDynamics':
    case 'RealityLoopMeshContacts.ImportedBvhParityProbe':
    case 'RealityLoopProviders.DefaultProbe':
    case 'RealityLoopProviders.AlternateProbe':
      return {}
  }
}

type RumocaPayload = {
  payload?: { names?: unknown; allData?: unknown; termination?: unknown }
  error?: unknown
}

export const decodeTrajectory = (raw: string, scenario: ModelicaScenario): {
  channelNames: string[]
  observations: ModelicaSample[]
} => {
  const result: RumocaPayload = JSON.parse(raw) as RumocaPayload
  if (result.error || !result.payload) {
    throw new Error('Rumoca simulation failed: ' + JSON.stringify(result.error ?? result))
  }
  if (result.payload.termination) {
    throw new Error('Rumoca terminated early: ' + JSON.stringify(result.payload.termination))
  }
  const names = result.payload.names
  const matrix = result.payload.allData
  if (!Array.isArray(names) || !names.every(x => typeof x === 'string') ||
      new Set(names).size !== names.length ||
      !Array.isArray(matrix) || matrix.length !== names.length + 1 ||
      !matrix.every(col => Array.isArray(col) && col.length === matrix[0]?.length) ||
      !matrix[0]?.length || matrix[0].length > 2001) {
    throw new Error('Rumoca returned an invalid trajectory layout')
  }
  const typed = matrix as number[][]
  const observations = typed[0].map((timeSeconds, i): ModelicaSample => {
    const values = Object.fromEntries(names.map((name, j) => [name, typed[j + 1][i]]))
    if (![timeSeconds, ...Object.values(values)].every(Number.isFinite)) {
      throw new Error('Rumoca trajectory contains non-finite values')
    }
    if (i > 0 && timeSeconds <= typed[0][i - 1]) {
      throw new Error('Rumoca trajectory time is not strictly increasing')
    }
    return { timeSeconds, channels: values }
  })
  const last = observations.at(-1)!.timeSeconds
  if (Math.abs(last - scenario.durationSeconds) > scenario.intervalSeconds * 0.1) {
    throw new Error('Rumoca did not reach the requested simulation horizon')
  }
  return { channelNames: names as string[], observations }
}

export const createModelicaRunner = async (wasmBytes: Uint8Array | ArrayBuffer) => {
  await initRumoca({ module_or_path: wasmBytes })
  wasm_init(0)
  return {
    simulate: (source: string, scenario: ModelicaScenario): ModelicaResult => {
      const { channelNames, observations } = decodeTrajectory(
        simulate_model(
          source, scenario.model, scenario.durationSeconds, scenario.intervalSeconds,
          'auto', JSON.stringify(makeOverrides(scenario)),
        ), scenario,
      )
      return {
        scenario,
        engine: { name: 'rumoca-wasm', version: get_version(),
          commit: get_git_commit() ?? 'unknown', solver: 'auto' },
        result: { passed: true, points: observations.length,
          finalTimeSeconds: observations.at(-1)!.timeSeconds },
        observations,
        channelNames,
      }
    },
  }
}
