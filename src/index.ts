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
export { realityLoopExamples, getRealityLoopExample, type RealityLoopExample } from './examples.ts'
export { runDagExperiment, createExecutionLock, type DagExperimentResult } from './dag.ts'
export { verifyDagReplay } from './dag-verify.ts'
export { exportDagVideo, resolveRecordedRun, type VideoManifest, type VideoExportResult } from './video-export.ts'
export { prepareVideoTrack, renderVideoFrame, type VideoSettings, type VideoTrack } from './video-render.ts'
