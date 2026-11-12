import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  canonicalHash, createDesignGraphRepository, type DagHash,
} from './vendor/taskyon-comp-dag.mjs'
import { createLocalDagStorage } from './dag-storage.ts'
import { createExecutionLock, runDagExperiment } from './dag.ts'

type StoredInvocation={
  rootNodeId:DagHash
  variables:Record<string,{kind:string;value?:unknown}>
}
type StoredRun={
  status:'completed'|'failed'|'cancelled'
  artifacts:Record<string,{id:DagHash}>
}
type ArtifactName='simulation'|'metrics'|'observations'
const artifacts=['simulation','metrics','observations'] as const

const constantInput=(invocation:StoredInvocation,name:string):unknown=>{
  const variable=invocation.variables[name]
  if(variable?.kind!=='constant'||!Object.hasOwn(variable,'value')) {
    throw Error('Unsupported DAG replay input: '+name)
  }
  return variable.value
}
const asObject=(value:unknown,name:string):Record<string,unknown>=>{
  if(!value||typeof value!=='object'||Array.isArray(value)) {
    throw Error('Invalid DAG replay '+name)
  }
  return value as Record<string,unknown>
}

/**
 * Provenance-aware, CACHE-BYPASSING replay verification of a canonical Taskyon
 * InvocationDefinition. Validates the source lock and stored artifact bytes,
 * then re-evaluates the same DAG nodes in a fresh isolated local object store.
 * It does not need Taskyon services, browser, Space or P2P.
 */
export const verifyDagReplay=async(
  invocationId:DagHash,
  options:{storageDirectory?:string;projectDirectory?:string}={},
):Promise<{
  verified:true
  invocationId:DagHash
  checkedRuns:number
  artifacts:Record<ArtifactName,DagHash>
}>=>{
  const projectDirectory=resolve(options.projectDirectory??import.meta.dirname+'/..')
  const storageDirectory=resolve(options.storageDirectory??join(process.cwd(),'runs/.dag'))
  const store=createLocalDagStorage(storageDirectory)
  const repository=createDesignGraphRepository(store.repositoryStore)
  const invocation=await repository.getInvocation(invocationId) as StoredInvocation
  const scenario=asObject(constantInput(invocation,'scenario'),'scenario')
  const lock=asObject(constantInput(invocation,'lock'),'source lock')
  const currentLock=await createExecutionLock(scenario,projectDirectory)
  if(canonicalHash(currentLock)!==canonicalHash(lock)){
    throw Error('DAG source lock mismatch: model, runtime, or code has changed')
  }
  const runs=await repository.listRuns(invocationId) as StoredRun[]
  const completed=runs.filter(run=>run.status==='completed')
  if(!completed.length)throw Error('No completed DAG run for invocation')
  const expected=Object.fromEntries(artifacts.map(name=>{
    const hash=completed[0]?.artifacts[name]?.id
    if(typeof hash!=='string'||!hash.startsWith('sha256:')) {
      throw Error('Missing DAG run artifact '+name)
    }
    return [name,hash]
  })) as Record<ArtifactName,DagHash>
  for(const run of completed){
    for(const name of artifacts){
      if(run.artifacts[name]?.id!==expected[name]){
        throw Error('Conflicting recorded artifacts for the same DAG invocation: '+name)
      }
    }
  }
  for(const name of artifacts){
    // DagStorageBackend verifies SHA-256 of stored JSON upon retrieval.
    await store.backend.readArtifact(expected[name])
  }
  const freshStore=await mkdtemp(join(tmpdir(),'realityloop-uncached-replay-'))
  try{
    const recomputed=await runDagExperiment(scenario,{
      projectDirectory,
      storageDirectory:freshStore,
    })
    if(recomputed.invocationId!==invocationId ||
       recomputed.nodes.simulation!==invocation.rootNodeId){
      throw Error('DAG replay identity diverged')
    }
    const actual:{
      [K in ArtifactName]:DagHash
    }={
      simulation:recomputed.resultArtifactId,
      metrics:recomputed.metricsArtifactId,
      observations:recomputed.sensorArtifactId,
    }
    for(const name of artifacts){
      if(actual[name]!==expected[name]){
        throw Error('DAG uncached replay produced different '+name+' artifact')
      }
    }
    return {verified:true,invocationId,checkedRuns:completed.length,artifacts:expected}
  }finally{
    await rm(freshStore,{recursive:true,force:true})
  }
}
