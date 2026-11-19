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
export { referenceFootprint,supermarketGeometrySha256 } from './geometry.ts'
export {importCollisionGLB,toBoxColliders,type CollisionAsset,type ColliderMesh,
  type BoxCollider} from './collision/mesh-import.ts'
export {importCollisionGeometry,type MeshFormat} from './collision/mesh-formats.ts'
export {buildCollisionBVH,queryCollisionBVH,type CollisionBVH} from './collision/bvh.ts'
export {collisionProviders,createExternalCollisionQuery,
  type CollisionQuery,type CollisionContact,type CollisionProvider,
  type ExternalCollisionProvider} from './collision/contract.ts'
export {
  solarPlantScenarioSchema,solarEquipment,plantLayout,solarPosition,
  trackerAngle,runSolarPlantExperiment,
  type SolarPlantResult,type SolarPlantSample,type SolarPlantScenario,
} from './solar-plant.ts'
export {
  satelliteModules,calculateSatelliteInertia,terrainHazards,terrainElevation,
  marsRoverCandidates,
  parseMissionScenario,runMissionExperiment,
  runSatelliteScenario,runTerrainScenario,
  satelliteScenarioSchema,terrainScenarioSchema,
  type MissionResult,type MissionScenario,type CubeModule,
} from './mission-experiments.ts'
export {
  signedFootprintClearance, clearanceAtPose, checkSweptClearance,
  type ClearanceReport, type ClearanceReading,
} from './clearance.ts'
export { realityLoopExamples, getRealityLoopExample, type RealityLoopExample } from './examples.ts'
export { runDagExperiment, createExecutionLock, type DagExperimentResult } from './dag.ts'
export { verifyDagReplay } from './dag-verify.ts'
export { exportDagVideo, resolveRecordedRun, type VideoManifest, type VideoExportResult } from './video-export.ts'
export { prepareVideoTrack, renderVideoFrame, type VideoSettings, type VideoTrack } from './video-render.ts'
