import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ExperimentResult } from './experiment.ts'
import { modelicaSourceFile, type ModelicaScenario } from './modelica/runtime.ts'
import { withModelicaScene } from './modelica/scene.ts'

const sha256 = (bytes: string | Uint8Array): string =>
  'sha256:' + createHash('sha256').update(bytes).digest('hex')

export type RunIntegrityReceipt = {
  schema: 'realityloop-run-integrity/v1'
  input: { sha256: string; bytes: number; scenarioName: string }
  engine: ExperimentResult['engine']
  model: null | { name: string; sourceSha256: string; compilerWasmSha256: string }
  result: { sha256: string; bytes: number; passed: boolean; observations: number }
  runtime: { node: string }
}

/** Independent byte-integrity evidence, NOT a Taskyon DAG invocation/cache key.
 * Graph identities and artifact storage remain owned by @taskyon/comp-dag. */
export const createRunIntegrityReceipt = async (
  scenarioBytes: Uint8Array,
  resultBytes: Uint8Array,
  result: ExperimentResult,
  projectDirectory: string = resolve(dirname(fileURLToPath(import.meta.url)),'..'),
  inputScenario?:unknown,
): Promise<RunIntegrityReceipt> => {
  const scenario = inputScenario && typeof inputScenario==='object' && !Array.isArray(inputScenario)
    ? inputScenario as ModelicaScenario : result.scenario
  let model: RunIntegrityReceipt['model'] = null
  if ('kind' in scenario && scenario.kind === 'modelica') {
    const typed = scenario as ModelicaScenario
    const source = await readFile(resolve(projectDirectory, 'modelica',
      modelicaSourceFile(typed.model)), 'utf8')
    const effectiveSource = typed.model.startsWith('RealityLoopContacts.Supermarket')
      ? withModelicaScene(source) : source
    const compilerDirectory = dirname(fileURLToPath(import.meta.resolve('@taskyon/rumoca')))
    const wasm = await readFile(join(compilerDirectory, 'rumoca_bind_wasm_bg.wasm'))
    model = {
      name: typed.model,
      sourceSha256: sha256(effectiveSource),
      compilerWasmSha256: sha256(wasm),
    }
  }
  return {
    schema: 'realityloop-run-integrity/v1',
    input: { sha256: sha256(scenarioBytes), bytes: scenarioBytes.byteLength,
      scenarioName: scenario.name },
    engine: result.engine,
    model,
    result: {
      sha256: sha256(resultBytes), bytes: resultBytes.byteLength,
      passed: result.result.passed, observations: result.observations.length,
    },
    runtime: { node: process.version },
  }
}
