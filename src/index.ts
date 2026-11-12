export { parseScenario, scenarioSchema, type Scenario } from './scenario.ts'
export { runScenario, type SimulationResult } from './sim.ts'
export {
  parseCleaningScenario, cleaningScenarioSchema, runCleaningScenario,
  supermarketObstacles, type CleaningScenario, type CleaningResult,
  type CleaningSample, type Obstacle,
} from './cleaning.ts'
export {
  parseTennantScenario, tennantScenarioSchema, runTennantScenario, t7amr,
  type TennantScenario, type TennantResult, type TennantSample,
} from './tennant.ts'
export { referenceFootprint } from './geometry.ts'
export {
  signedFootprintClearance, clearanceAtPose, checkSweptClearance,
  type ClearanceReport, type ClearanceReading,
} from './clearance.ts'
