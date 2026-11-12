import {
  canonicalHash, createNode, type DagHash,
} from './vendor/taskyon-comp-dag.mjs'

export type DagScenario = Record<string,unknown>
export type DagParameters<TLock extends object> = {
  scenario:DagScenario
  lock:TLock
}
export type DagMetrics<R extends {result:{passed:boolean};observations:readonly unknown[]}> = {
  passed:boolean
  observations:number
  details:R['result']
}

const openObject={type:'object',additionalProperties:true} as const
const paramsSchema={
  type:'object',
  properties:{scenario:openObject,lock:openObject},
  required:['scenario','lock'],
  additionalProperties:false,
} as const

/** The canonical Taskyon DAG node chain, reusable in Node and browser.
 * Physics is injected, allowing Modelica/Rumoca and other backends to share
 * execution identity and dependency tracking without any UI/P2P coupling. */
export const createRealityLoopNodes = <
  R extends {result:{passed:boolean};observations:readonly unknown[]},
  L extends object,
>(args:{
  versionIdentity:DagHash
  evaluate:(params:DagParameters<L>,scenario:DagScenario)=>Promise<R>|R
  observe?:(simulation:R)=>unknown|Promise<unknown>
})=>{
  type Params=DagParameters<L>
  const identity=(name:string):DagHash=>canonicalHash({
    kind:'realityloop.dag.node/v1',name,version:1,implementation:args.versionIdentity,
  })
  const scenarioNode=createNode<Params,DagScenario>({
    name:'RealityLoop.Scenario',version:1,contentHash:identity('Scenario'),
    localParams:paramsSchema,outputSchema:openObject,
    run:params=>params.scenario,
  })
  const simulationNode=createNode<Params,R>({
    name:'RealityLoop.Simulation',version:1,contentHash:identity('Simulation'),
    localParams:paramsSchema,hiddenInputs:{scenario:scenarioNode},
    outputSchema:openObject,
    run:async(params,use)=>args.evaluate(params,await use.scenario(params) as DagScenario),
  })
  const metricsNode=createNode<Params,DagMetrics<R>>({
    name:'RealityLoop.Metrics',version:1,contentHash:identity('Metrics'),
    localParams:paramsSchema,hiddenInputs:{simulation:simulationNode},
    outputSchema:openObject,
    run:async(params,use)=>{
      const simulation=await use.simulation(params) as R
      return {passed:simulation.result.passed,
        observations:simulation.observations.length,details:simulation.result}
    },
  })
  const observationsNode=createNode<Params,Record<string,unknown>>({
    name:'RealityLoop.Observations',
    version:1,
    contentHash:identity('Observations'),
    localParams:paramsSchema,
    hiddenInputs:{simulation:simulationNode},
    outputSchema:openObject,
    run:async(params,use)=>{
      const simulation=await use.simulation(params) as R
      return (args.observe ? await args.observe(simulation)
        : {schema:'realityloop.sensor-observations/v1',available:false,frames:[],lidar:[]}
      ) as Record<string,unknown>
    },
  })
  return {
    scenarioNode,simulationNode,metricsNode,observationsNode,
    nodes:{
      scenario:scenarioNode.contentHash!,
      simulation:simulationNode.contentHash!,
      metrics:metricsNode.contentHash!,
      observations:observationsNode.contentHash!,
    },
  }
}
