import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createMujocoCollisionScene } from '../mujoco-collision.ts'

export type ExternalMuJoCoSample = {
  timeSeconds: number
  x: number
  z: number
  yaw: number
  depth: number
}
export type ExternalMuJoCoReport = {
  engine: 'rumoca-wasm-external-c-real3'
  backend: '@mujoco/mujoco'
  model: 'RealityLoopMuJoCoHost.CollisionProbe'
  calls: number
  maximumPenetrationMetres: number
  observations: ExternalMuJoCoSample[]
}

type HostRuntime = {
  default: (args: { module_or_path: Uint8Array }) => Promise<unknown>
  wasm_init: (threads: number) => unknown
  simulate_model_with_external_real3: (
    source: string, name: string, duration: number, dt: number,
    solver: string, overrides: string,
    callback: (x: number, z: number, yaw: number) => number,
  ) => string
}

export const runMuJoCoExternalModelica = async (
  externalWasmDirectory: string,
): Promise<ExternalMuJoCoReport> => {
  const directory = resolve(externalWasmDirectory)
  const runtime = await import(
    pathToFileURL(join(directory, 'rumoca_bind_wasm.js')).href
  ) as HostRuntime
  if (typeof runtime.simulate_model_with_external_real3 !== 'function') {
    throw new Error('Rumoca WASM runtime has no scoped external C real3 host API')
  }
  await runtime.default({
    module_or_path: await readFile(join(directory, 'rumoca_bind_wasm_bg.wasm')),
  })
  runtime.wasm_init(0)

  const modelica = await readFile(
    fileURLToPath(new URL('../../modelica/RealityLoopMuJoCoHost.mo', import.meta.url)),
    'utf8',
  )
  const scene = await createMujocoCollisionScene()
  let calls = 0
  try {
    const raw: unknown = JSON.parse(runtime.simulate_model_with_external_real3(
      modelica, 'RealityLoopMuJoCoHost.CollisionProbe', 2, 0.05, 'auto', '{}',
      (x, z, yaw) => {
        calls++
        const contacts = scene.query({ x, z, yaw })
        return Math.max(0, ...contacts.map(contact => contact.penetrationMetres))
      },
    ))
    if (typeof raw !== 'object' || !raw || !('payload' in raw)) {
      throw new Error('Rumoca host simulation did not return a trajectory')
    }
    const payload = raw.payload as { names: string[]; allData: number[][] }
    const index = (name: string) => {
      const i = payload.names.indexOf(name)
      if (i < 0) throw new Error('Missing required Modelica channel ' + name)
      return i + 1
    }
    const t = payload.allData[0]
    if (!Array.isArray(t) || t.length < 5 || t.length > 1000) {
      throw new Error('Invalid Modelica external run time samples')
    }
    const x = payload.allData[index('x')]
    const z = payload.allData[index('z')]
    const yaw = payload.allData[index('yaw')]
    const depth = payload.allData[index('depth')]
    const observations = t.map((timeSeconds, i) => ({
      timeSeconds, x: x[i], z: z[i], yaw: yaw[i], depth: depth[i],
    }))
    if (!calls || observations.some(sample =>
      !Object.values(sample).every(Number.isFinite))) {
      throw new Error('External C MuJoCo probe returned nonfinite or unexecuted results')
    }
    return {
      engine: 'rumoca-wasm-external-c-real3',
      backend: '@mujoco/mujoco',
      model: 'RealityLoopMuJoCoHost.CollisionProbe',
      calls,
      maximumPenetrationMetres: Math.max(...depth),
      observations,
    }
  } finally {
    scene.close()
  }
}
