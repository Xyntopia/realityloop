import { canonicalHash } from './vendor/taskyon-comp-dag.mjs'
import { createRealityLoopNodes, type DagScenario } from './dag-nodes.ts'
import {createSensorObservations} from './observations.ts'
import dagRuntimeLock from './vendor/taskyon-comp-dag.lock.json'

// Vite embeds the current implementation source, ensuring HMR/production
// releases cannot reuse an earlier browser DAG result after a code change.
const implementations=import.meta.glob('./**/*.ts',
  {query:'?raw',import:'default',eager:true}) as Record<string,string>
const implementationHash=canonicalHash(implementations)

/** Digest the exact binary before handing it to a browser WASM runtime. */
export const hashBrowserBinary=async(bytes:ArrayBuffer):Promise<string>=>{
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))
  return 'sha256:'+Array.from(digest,value=>value.toString(16).padStart(2,'0')).join('')
}

/**
 * The exact same Taskyon node engine used by the headless CLI, with an
 * in-memory artifact cache in browser mode. Browser storage/export of the
 * invocation records is a future step; P2P and Taskyon UI are never required.
 */
export const runBrowserDag = async<
  R extends {result:{passed:boolean};observations:readonly unknown[]},
>(
  scenario:DagScenario,
  sourceLock:Record<string,unknown>,
  evaluate:(scenario:DagScenario)=>Promise<R>|R,
):Promise<{result:R;artifactHash:string;nodes:Record<string,string>}>=>{
  const lock={
    schema:'realityloop.browser-source/v2',
    implementationHash,
    dagRuntimeHash:dagRuntimeLock.bundleSha256,
    ...sourceLock,
  }
  const {simulationNode,metricsNode,observationsNode,nodes}=createRealityLoopNodes<R,typeof lock>({
    versionIdentity:canonicalHash({
      kind:'realityloop.browser-node/v1',lock,
    }),
    evaluate:async(_params,requested)=>evaluate(requested),
    observe:createSensorObservations,
  })
  const params={scenario,lock}
  const ctx={nowUtcMs:Date.now(),log:()=>undefined}
  const config={execution:{mode:'local' as const}}
  const simulation=await simulationNode.call(params).run(ctx,config)
  await metricsNode.call(params).run(ctx,config)
  await observationsNode.call(params).run(ctx,config)
  return {result:simulation.value,artifactHash:simulation.artifactHash,nodes}
}
