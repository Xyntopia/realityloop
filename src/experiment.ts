import { parseScenario } from './scenario.ts'
import { runScenario, type SimulationResult } from './sim.ts'
import { parseCleaningScenario, runCleaningScenario, type CleaningResult } from './cleaning.ts'
import { parseTennantScenario, runTennantScenario, type TennantResult } from './tennant.ts'
import type { ModelicaResult } from './modelica/runtime.ts'
import type { SupermarketReplay } from './modelica/supermarket.ts'
import {runMissionExperiment,type MissionResult} from './mission-experiments.ts'

export type ExperimentResult =
  | SimulationResult | CleaningResult | TennantResult | ModelicaResult | SupermarketReplay
  | MissionResult

/** Run a validated, allowlisted scenario. No viewer, Taskyon or DAG required. */
export const runExperiment = async (
  raw: unknown,
  projectDirectory: string = process.cwd(),
): Promise<ExperimentResult> => {
  const object = typeof raw === 'object' && raw !== null ? raw : {}
  if ('kind' in object && ['satellite-adcs','orbital-docking','terrain-traverse'].includes(String(object.kind))){
    return runMissionExperiment(raw)
  }
  if ('kind' in object && object.kind === 'modelica') {
    const { parseModelicaScenario } = await import('./modelica/runtime.ts')
    const { runModelicaScenario } = await import('./modelica/node.ts')
    const scenario = parseModelicaScenario(raw)
    const model = await runModelicaScenario(scenario, projectDirectory)
    if (scenario.model === 'RealityLoopContacts.SupermarketRobot' ||
        scenario.model === 'RealityLoopContacts.SupermarketBlocked') {
      const { toSupermarketReplay } = await import('./modelica/supermarket.ts')
      return toSupermarketReplay(model)
    }
    return model
  }
  if ('vehicle' in object) return runTennantScenario(parseTennantScenario(raw))
  if ('route' in object) return runCleaningScenario(parseCleaningScenario(raw))
  return runScenario(parseScenario(raw))
}
