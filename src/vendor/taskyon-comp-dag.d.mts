/** Type surface for the *bundled* Taskyon comp-dag runtime.
 * Implementation is generated from frontend/packages/comp-dag; never edit mjs manually. */
export type DagHash = `sha256:${string}`
export type DagContext = {nowUtcMs:number;log:(message:string,data?:unknown)=>void}
export type DagStorageBackend = {
  readArtifact<T>(hash:DagHash):Promise<T>|T
  writeArtifact(value:unknown):Promise<DagHash>|DagHash
  getCacheEntry(key:string):Promise<{artifact:DagHash}|null>|{artifact:DagHash}|null
  setCacheEntry(key:string,entry:{artifact:DagHash}):Promise<void>|void
}
export type DagNode<P=Record<string,unknown>,O=unknown> = {
  name:string;version:number;effect:string;contentHash?:DagHash
  call(params:P):{run(ctx?:DagContext, config?:{
    execution?:{mode:'local'|'worker'}
    storageBackend?:DagStorageBackend
  }):Promise<{value:O;artifactHash:DagHash}>}
}
export function createNode<P=Record<string,unknown>,O=unknown>(args:{
  name:string;version:number;description?:string;contentHash?:DagHash
  effect?:'pure'|'source'
  localParams?:object
  hiddenInputs?:Record<string,DagNode>
  outputSchema:object
  policy?:{cache:'NoCache'|'ReadOnly'|'WriteOnly'|'ReadWrite';scope:'Environment'|'ModelState'|'Debug'}
  run:(params:P,use:Record<string,(params:unknown)=>Promise<unknown>>,ctx?:DagContext)=>Promise<O>|O
}):DagNode<P,O>
export function canonicalHash(value:unknown):DagHash
export class MissingDagArtifact extends Error {
  readonly hash:DagHash
  constructor(hash:DagHash)
}
export type DagObjectStore = {
  readText(path:string):Promise<string>
  writeText(path:string,content:string):Promise<void>
  writeTextIfUnchanged(path:string,expectedContentHash:string|null,content:string):Promise<{written:boolean;currentContentHash:string|null}>
  list(directory:string):Promise<string[]>
}
export type Repository = {
  putGraphRevision(record:unknown):Promise<DagHash>
  getGraphRevision(id:DagHash):Promise<unknown>
  putInvocation(record:unknown):Promise<DagHash>
  getInvocation(id:DagHash):Promise<unknown>
  putRun(record:unknown):Promise<DagHash>
  getRun(invocationId:DagHash,runId:DagHash):Promise<unknown>
  listRuns(invocationId?:DagHash):Promise<unknown[]>
  putProjectRevision(record:unknown):Promise<DagHash>
  getProjectRevision(id:DagHash):Promise<unknown>
  advanceProjectRef(args:{name:string;revisionId:DagHash;expected:DagHash|null}):Promise<unknown>
  getProjectRef(name:string):Promise<{revisionId:DagHash}|null>
}
export function createDesignGraphRepository(store:DagObjectStore):Repository
export function createGraphRevision(input:{parents:DagHash[];nodes:Record<string,DagHash>}):{schemaVersion:2;id:DagHash;parents:DagHash[];nodes:Record<string,DagHash>}
export function createInvocationDefinition(input:{
  rootNodeId:DagHash;variables:Record<string,unknown>
  inputs?:Record<string,unknown>;objectives:unknown[];constraints:unknown[];
  capture?:unknown[];policy:{accuracy:'exact'|'auto'};reducerOverrides:Record<string,unknown>
}):{schemaVersion:2;id:DagHash;rootNodeId:DagHash;variables:Record<string,unknown>;inputs:Record<string,unknown>;objectives:unknown[];constraints:unknown[];capture:unknown[];policy:{accuracy:string};reducerOverrides:Record<string,unknown>}
export function resolveInvocationPolicy(invocation:ReturnType<typeof createInvocationDefinition>):{
  engine:{id:string;version:number};accuracy:'exact';strategies:Record<string,unknown>
}
export function createInvocationRun(input:{
  invocationId:DagHash;resolvedPolicy:ReturnType<typeof resolveInvocationPolicy>
  status:'completed'|'failed'|'cancelled';startedAtMs:number;completedAtMs:number
  artifacts:Record<string,DagHash|{id:DagHash;mediaType?:string;size?:number}>
  provenance:Record<string,unknown>;error?:string
}):{schemaVersion:2;id:DagHash;invocationId:DagHash}
export function createProjectRevision(input:{
  parents:DagHash[];displayName:string;invocations:Record<string,DagHash>;extensions:Record<string,DagHash>
}):{schemaVersion:2;id:DagHash;parents:DagHash[];invocations:Record<string,DagHash>}
