import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  canonicalHash, createGraphRevision, createInvocationDefinition,
  createInvocationRun, createProjectRevision, createDesignGraphRepository,
  resolveInvocationPolicy, type DagHash,
} from './vendor/taskyon-comp-dag.mjs'
import { createRealityLoopNodes, type DagMetrics } from './dag-nodes.ts'
import {createSensorObservations,type RealityLoopObservations} from './observations.ts'
import { createLocalDagStorage } from './dag-storage.ts'
import { runExperiment, type ExperimentResult } from './experiment.ts'
import { modelicaSourceFile, parseModelicaScenario } from './modelica/runtime.ts'
import { withModelicaScene } from './modelica/scene.ts'

const sha256 = (bytes:Uint8Array|string) =>
  'sha256:' + createHash('sha256').update(bytes).digest('hex')
const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)),'../src')
/** Fingerprint all project implementation sources instead of a manually
 * curated list that could silently miss a future physics/sensor dependency. */
const sourceFingerprints = async (directory: string): Promise<[string,string][]> => {
  const entries = await readdir(directory, {withFileTypes:true})
  const children = await Promise.all(entries.map(async entry => {
    const path = join(directory,entry.name)
    if(entry.isDirectory()) return sourceFingerprints(path)
    if(!entry.isFile() || !/\.(?:ts|mts|js|mjs|json)$/.test(entry.name)) {
      return [] as [string,string][]
    }
    return [[relative(sourceRoot,path).replaceAll('\\','/'),
      sha256(await readFile(path))] as [string,string]]
  }))
  return children.flat().sort(([a],[b])=>a.localeCompare(b))
}

type Scenario = Record<string,unknown>
type ExecutionLock = {
  schema: 'realityloop-dag-lock/v2'
  sourceHash: string
  modelHash: string | null
  runtimeHash: string | null
  dagRuntimeHash: string
  nodeRuntime: {version:string;platform:string;arch:string}
  nodeVersion: number
}
type Params = {scenario:Scenario;lock:ExecutionLock}
type Metrics = DagMetrics<ExperimentResult>
export type DagExperimentResult = {
  result:ExperimentResult
  resultArtifactId:DagHash
  metrics:Metrics
  sensorObservations:RealityLoopObservations
  sensorArtifactId:DagHash
  metricsArtifactId:DagHash
  graphRevisionId:DagHash
  invocationId:DagHash
  invocationRunId:DagHash
  projectRevisionId:DagHash
  nodes:Record<'scenario'|'simulation'|'metrics'|'observations',DagHash>
  lock:ExecutionLock
}

/** Lock source + physics compiler bytes before computing a DAG cache key. */
export const createExecutionLock = async (
  raw:Scenario, projectDirectory:string=resolve(sourceRoot,'..'),
):Promise<ExecutionLock> => {
  const sourceHashes=await sourceFingerprints(sourceRoot)
  const dependencyLockHash=sha256(await readFile(resolve(projectDirectory,'package-lock.json')))
  let modelHash:string|null=null
  let runtimeHash:string|null=null
  if(raw.kind==='modelica'){
    const model=parseModelicaScenario(raw)
    const source=await readFile(resolve(projectDirectory,'modelica',
      modelicaSourceFile(model.model)),'utf8')
    modelHash=sha256(model.model.startsWith('RealityLoopContacts.Supermarket')
      ? withModelicaScene(source):source)
    const wasmDir=dirname(fileURLToPath(import.meta.resolve('@taskyon/rumoca')))
    runtimeHash=sha256(await readFile(join(wasmDir,'rumoca_bind_wasm_bg.wasm')))
  }
  const dagRuntimeHash=sha256(await readFile(resolve(sourceRoot,'vendor/taskyon-comp-dag.mjs')))
  return {
    schema:'realityloop-dag-lock/v2',
    sourceHash:canonicalHash({files:sourceHashes,dependencies:dependencyLockHash}),
    modelHash,runtimeHash,dagRuntimeHash,
    nodeVersion:2,
    nodeRuntime:{version:process.versions.node,platform:process.platform,arch:process.arch},
  }
}

/**
 * Canonical @taskyon/comp-dag nodes execute every experiment, including the CLI.
 * The filesystem backend only implements Taskyon's injected object-store API:
 * it is not an alternative DAG engine or a second graph format.
 */
export const runDagExperiment = async (
  scenario:Scenario,
  options:{
    projectDirectory?:string
    storageDirectory?:string
    onSimulation?:()=>void
  }={},
):Promise<DagExperimentResult> => {
  const projectDirectory=resolve(options.projectDirectory ?? resolve(sourceRoot,'..'))
  const storageDirectory=resolve(options.storageDirectory ?? join(process.cwd(),'runs/.dag'))
  const lock=await createExecutionLock(scenario,projectDirectory)
  const params:Params={scenario,lock}
  const environment={execution:{mode:'local' as const}}
  const store=createLocalDagStorage(storageDirectory)
  const engine={...environment,storageBackend:store.backend}
  const {simulationNode,metricsNode,observationsNode,nodes:ids}=createRealityLoopNodes<
    ExperimentResult,ExecutionLock
  >({
    versionIdentity:canonicalHash({
      sourceHash:lock.sourceHash,dagRuntimeHash:lock.dagRuntimeHash,
    }),
    evaluate:async(params,requested)=>{
      const current=await createExecutionLock(requested,projectDirectory)
      if(canonicalHash(current)!==canonicalHash(params.lock)) {
        throw Error('Simulation source or runtime changed since DAG invocation was pinned')
      }
      options.onSimulation?.()
      return runExperiment(requested,projectDirectory)
    },
    observe:createSensorObservations,
  })
  const ctx={nowUtcMs:Date.now(),log:()=>undefined}
  const start=Date.now()
  const simulation=await simulationNode.call(params).run(ctx,engine)
  const metrics=await metricsNode.call(params).run(ctx,engine)
  const observed=await observationsNode.call(params).run(ctx,engine)
  const repository=createDesignGraphRepository(store.repositoryStore)
  const graph=createGraphRevision({parents:[],nodes:ids})
  const invocation=createInvocationDefinition({
    rootNodeId:ids.simulation,
    variables:{
      scenario:{kind:'constant',value:scenario},
      lock:{kind:'constant',value:lock},
    },
    inputs:{},objectives:[],constraints:[],capture:[],
    policy:{accuracy:'exact'},reducerOverrides:{},
  })
  await repository.putGraphRevision(graph)
  await repository.putInvocation(invocation)
  const run=createInvocationRun({
    invocationId:invocation.id,
    resolvedPolicy:resolveInvocationPolicy(invocation),
    status:'completed',startedAtMs:start,completedAtMs:Date.now(),
    artifacts:{
      simulation:{id:simulation.artifactHash,mediaType:'application/json'},
      metrics:{id:metrics.artifactHash,mediaType:'application/json'},
      observations:{id:observed.artifactHash,mediaType:'application/json'},
    },
    provenance:{
      source:lock,
      nodes:ids,
      graphRevisionId:graph.id,
      execution:'local',
      transport:'none',
    },
  })
  await repository.putRun(run)
  // Create canonical Taskyon project records locally. P2P and Taskyon UI are
  // optional sync/display surfaces, not part of execution or persistence.
  const previous=await repository.getProjectRef('projects/realityloop')
  const previousRevision=previous
    ? await repository.getProjectRevision(previous.revisionId) as {
      invocations:Record<string,DagHash>;id:DagHash}
    : null
  // A repeat execution of an existing invocation is a new run, not a new
  // project revision. Only additions to the immutable invocation set advance it.
  const projectId=previousRevision?.invocations[invocation.id]===invocation.id
    ? previousRevision.id
    : await (async()=>{
      const project=createProjectRevision({
        parents:previousRevision?[previousRevision.id]:[],
        displayName:'RealityLoop local experiments',
        invocations:{
          ...(previousRevision?.invocations??{}),
          [invocation.id]:invocation.id,
        },
        extensions:{},
      })
      await repository.putProjectRevision(project)
      await repository.advanceProjectRef({
        name:'projects/realityloop',revisionId:project.id,
        expected:previous?.revisionId??null,
      })
      return project.id
    })()
  return {
    result:simulation.value,
    resultArtifactId:simulation.artifactHash,
    metrics:metrics.value,
    sensorObservations:observed.value as RealityLoopObservations,
    sensorArtifactId:observed.artifactHash,
    metricsArtifactId:metrics.artifactHash,
    graphRevisionId:graph.id,
    invocationId:invocation.id,
    invocationRunId:run.id,
    projectRevisionId:projectId,
    nodes:ids,lock,
  }
}
