import {strict as assert} from 'node:assert'
import {test} from 'node:test'
import {fileURLToPath} from 'node:url'
import {runModelicaScenario} from '../src/modelica/node.ts'
import {parseModelicaScenario} from '../src/modelica/runtime.ts'

const directory=fileURLToPath(new URL('..',import.meta.url))

test('Rumoca evaluates GLB-derived BVH and brute-force 3D contact in numerical parity',async()=>{
  const run=await runModelicaScenario(parseModelicaScenario({
    name:'bvh-parity-glb',kind:'modelica',
    model:'RealityLoopMeshContacts.ImportedBvhParityProbe',
    durationSeconds:1.6,intervalSeconds:0.05,
    frictionCoefficient:0.72,motorTorqueNewtonMetres:0,
  }),directory)
  const channels=run.observations.map(s=>s.channels)
  assert(channels.length>=30)
  for(const c of channels){
    assert(c.depthError<1e-7,'BVH depth must match exhaustive mesh query')
    assert(c.nearestDistanceError<1e-7,'BVH surface distance must match')
    assert(c.normalError<1e-6,'BVH normals must match exhaustive mesh query')
    assert(c.trianglesTested>0&&c.trianglesTested<=12,
      'BVH must only traverse the target box collider, not all five')
    assert(c.nodesVisited>0&&c.nodesVisited<=7)
  }
  // A single 12-triangle box has overlapping face bounds: BVH overhead
  // may exceed brute force. The guarantee here is exact parity and bounded
  // work, not an invented speedup on this deliberately tiny mesh.
})
