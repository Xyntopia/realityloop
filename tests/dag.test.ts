import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { runDagExperiment } from '../src/dag.ts'
import { verifyDagReplay } from '../src/dag-verify.ts'
import { createLocalDagStorage } from '../src/dag-storage.ts'
import { createDesignGraphRepository, canonicalHash } from '../src/vendor/taskyon-comp-dag.mjs'

const projectDirectory=fileURLToPath(new URL('..',import.meta.url))
const scenario={
  name:'dag-cache-wheel',kind:'modelica',
  model:'RealityLoopContacts.WheelBench',
  durationSeconds:1,intervalSeconds:0.025,
  frictionCoefficient:0.7,motorTorqueNewtonMetres:10,
}

test('canonical DAG nodes cache repeat Modelica runs in a persistent local store',async()=>{
  const base=await mkdtemp(join(tmpdir(),'realityloop-dag-'))
  let executions=0
  try{
    const options={projectDirectory,storageDirectory:base,onSimulation:()=>{executions++}}
    const first=await runDagExperiment(scenario,options)
    const second=await runDagExperiment(scenario,options)
    assert.equal(executions,1)
    assert.equal(first.resultArtifactId,second.resultArtifactId)
    assert.equal(first.invocationId,second.invocationId)
    assert.equal(first.graphRevisionId,second.graphRevisionId)
    assert.equal(first.sensorArtifactId,second.sensorArtifactId)
    assert.equal(first.sensorObservations.available,false)
    assert.equal(first.metricsArtifactId,second.metricsArtifactId)
    const store=createLocalDagStorage(base)
    const repository=createDesignGraphRepository(store.repositoryStore)
    const graph=await repository.getGraphRevision(first.graphRevisionId) as {nodes:Record<string,string>}
    assert.equal(graph.nodes.simulation,first.nodes.simulation)
    const invocation=await repository.getInvocation(first.invocationId) as {rootNodeId:string}
    assert.equal(invocation.rootNodeId,first.nodes.simulation)
    const runs=await repository.listRuns(first.invocationId) as Array<{artifacts:{simulation:{id:string};observations:{id:string}}}>
    assert.ok(runs.length>0 && runs.every(run=>
      run.artifacts.simulation.id===first.resultArtifactId &&
      run.artifacts.observations.id===first.sensorArtifactId))
    const ref=await repository.getProjectRef('projects/realityloop')
    assert.equal(ref?.revisionId,first.projectRevisionId)
    const value=await store.backend.readArtifact(first.resultArtifactId)
    const verified=await verifyDagReplay(first.invocationId,{
      projectDirectory,storageDirectory:base,
    })
    assert.equal(verified.verified,true)
    assert.equal(verified.checkedRuns,2)
    assert.equal(verified.artifacts.simulation,first.resultArtifactId)
    assert.equal(verified.artifacts.observations,first.sensorArtifactId)
    assert.equal(canonicalHash(value),first.resultArtifactId)
  } finally {await rm(base,{recursive:true,force:true})}
})

test('different input parameters produce a different Taskyon invocation and artifacts',async()=>{
  const base=await mkdtemp(join(tmpdir(),'realityloop-dag-params-'))
  try{
    const low=await runDagExperiment(scenario,{projectDirectory,storageDirectory:base})
    const high=await runDagExperiment({...scenario,motorTorqueNewtonMetres:35},
      {projectDirectory,storageDirectory:base})
    assert.notEqual(low.invocationId,high.invocationId)
    assert.notEqual(low.resultArtifactId,high.resultArtifactId)
    assert.equal(low.nodes.simulation,high.nodes.simulation)
    const repository=createDesignGraphRepository(createLocalDagStorage(base).repositoryStore)
    const ref=await repository.getProjectRef('projects/realityloop')
    assert.ok(ref)
    const revision=await repository.getProjectRevision(ref.revisionId) as {
      invocations:Record<string,string>
    }
    assert.ok(Object.values(revision.invocations).includes(low.invocationId))
    assert.ok(Object.values(revision.invocations).includes(high.invocationId))
  }finally{await rm(base,{recursive:true,force:true})}
})

test('changing Modelica source invalidates the DAG invocation even when output is unchanged',async()=>{
  const base=await mkdtemp(join(tmpdir(),'realityloop-source-lock-'))
  try{
    const modelDirectory=join(base,'modelica')
    await mkdir(modelDirectory)
    const modelName='RealityLoopContacts.mo'
    const original=await readFile(join(projectDirectory,'modelica',modelName),'utf8')
    const dependencyLock=await readFile(join(projectDirectory,'package-lock.json'))
    await writeFile(join(base,'package-lock.json'),dependencyLock)
    await writeFile(join(modelDirectory,modelName),original)
    let evaluations=0
    const options={
      projectDirectory:base,
      storageDirectory:join(base,'store'),
      onSimulation:()=>{evaluations++},
    }
    const first=await runDagExperiment(scenario,options)
    await writeFile(join(modelDirectory,modelName),original+'\n// Reproducibility fixture revision\n')
    const second=await runDagExperiment(scenario,options)
    assert.equal(evaluations,2)
    assert.notEqual(first.lock.modelHash,second.lock.modelHash)
    assert.notEqual(first.invocationId,second.invocationId)
    assert.equal(first.nodes.simulation,second.nodes.simulation,
      'same executable node but changed input/source lock')
    await assert.rejects(
      ()=>verifyDagReplay(first.invocationId,{
        projectDirectory:base,storageDirectory:options.storageDirectory,
      }),
      /source lock mismatch/,
    )
    assert.equal(first.resultArtifactId,second.resultArtifactId,
      'benign source comment yields identical trajectory but a separate invocation')
  }finally{await rm(base,{recursive:true,force:true})}
})

test('pinned DAG bundle checksum and artifact tampering are detected',async()=>{
  const bytes=await readFile(fileURLToPath(new URL('../src/vendor/taskyon-comp-dag.mjs',import.meta.url)))
  const text=await readFile(fileURLToPath(
    new URL('../src/vendor/taskyon-comp-dag.lock.json',import.meta.url)),'utf8')
  const manifest=JSON.parse(text) as {bundleSha256:string;source:string;inputCount:number}
  assert.equal('sha256:'+createHash('sha256').update(bytes).digest('hex'),manifest.bundleSha256)
  assert.ok(manifest.source.includes('comp-dag') && manifest.inputCount>20)
  const base=await mkdtemp(join(tmpdir(),'realityloop-dag-corrupt-'))
  try{
    const store=createLocalDagStorage(base)
    const id=await store.backend.writeArtifact({numbers:[1,2,3]})
    const path=join(base,'artifacts',id.replace(':','_')+'.json')
    await writeFile(path,JSON.stringify({numbers:[5,6,7]}))
    await assert.rejects(async()=>store.backend.readArtifact(id),/checksum mismatch/)
  } finally {await rm(base,{recursive:true,force:true})}
})
