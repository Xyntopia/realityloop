import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createModelicaRunner, modelicaSourceFile,
  type ModelicaResult, type ModelicaScenario,
} from './runtime.ts'
import { withModelicaScene } from './scene.ts'
export { withModelicaScene } from './scene.ts'
import type { Obstacle } from '../geometry.ts'

export const runModelicaScenario = async (
  scenario: ModelicaScenario,
  projectDirectory: string = process.cwd(),
  obstacles?: readonly Obstacle[],
): Promise<ModelicaResult> => {
  const packageDirectory = dirname(fileURLToPath(import.meta.resolve('@taskyon/rumoca')))
  const [wasmBytes, source] = await Promise.all([
    readFile(join(packageDirectory, 'rumoca_bind_wasm_bg.wasm')),
    readFile(resolve(projectDirectory, 'modelica', modelicaSourceFile(scenario.model)), 'utf8'),
  ])
  const runner = await createModelicaRunner(wasmBytes)
  const sceneSource = scenario.model.startsWith('RealityLoopContacts.Supermarket')
    ? withModelicaScene(source, obstacles)
    : source
  return runner.simulate(sceneSource, scenario)
}
