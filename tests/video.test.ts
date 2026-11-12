import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { prepareVideoTrack, renderVideoFrame, validateVideoSettings } from '../src/video-render.ts'
import { runDagExperiment } from '../src/dag.ts'
import { exportDagVideo } from '../src/video-export.ts'
import { createLocalDagStorage } from '../src/dag-storage.ts'
import { createDesignGraphRepository } from '../src/vendor/taskyon-comp-dag.mjs'

const spatial={
  scenario:{name:'supermarket-render-test'},
  engine:{name:'rumoca-wasm',version:'test'},
  result:{passed:true},
  observations:[
    {timeSeconds:0,x:0,z:0,yaw:0,speed:.5,cleanedAreaSqMetres:0},
    {timeSeconds:.4,x:.3,z:.1,yaw:.2,speed:.6,cleanedAreaSqMetres:.3},
    {timeSeconds:.8,x:.6,z:.25,yaw:.3,speed:.6,cleanedAreaSqMetres:.6},
  ],
}
const nonSpatial={
  scenario:{name:'traction bench'},
  result:{passed:false},
  observations:[
    {timeSeconds:0,channels:{speed:0,traction:0}},
    {timeSeconds:.5,channels:{speed:.3,traction:20}},
    {timeSeconds:1,channels:{speed:.8,traction:25}},
  ],
}
test('video renderer deterministically renders a time-sampled 3D-pose replay without a DOM',()=>{
  const track=prepareVideoTrack(spatial)
  assert.equal(track.mode,'spatial')
  assert.equal(track.obstacleScene,true)
  const settings={width:480,height:270,fps:10}
  assert.equal(validateVideoSettings(settings,track),9)
  const first=renderVideoFrame(track,settings,0)
  const repeated=renderVideoFrame(track,settings,0)
  const last=renderVideoFrame(track,settings,8)
  assert.equal(first.length,480*270*3)
  assert.deepEqual(first,repeated)
  assert.notEqual(createHash('sha256').update(first).digest('hex'),
    createHash('sha256').update(last).digest('hex'))
  assert.throws(()=>renderVideoFrame(track,settings,9),/frame index/)
})
test('headless video also supports Modelica time-series experiments without spatial poses',()=>{
  const track=prepareVideoTrack(nonSpatial)
  assert.equal(track.mode,'timeseries')
  assert.deepEqual(track.fields.slice(0,2),['speed','traction'])
  assert.equal(renderVideoFrame(track,{width:640,height:360,fps:12},4).length,640*360*3)
  assert.throws(()=>validateVideoSettings({fps:60,width:640,height:360},track),/FPS/)
  assert.throws(()=>validateVideoSettings({fps:12,width:641,height:360},track),/dimensions/)
  assert.throws(()=>prepareVideoTrack({...nonSpatial,observations:[
    {timeSeconds:.1,channels:{speed:1}},
    {timeSeconds:.1,channels:{speed:2}},
  ]}),/timestamps/)
})

const ffmpeg=process.env.REALITYLOOP_TEST_FFMPEG
test('video is a derived canonical DAG run, preserving recorded physics and media bytes',{
  skip:!ffmpeg && 'Set REALITYLOOP_TEST_FFMPEG to an FFmpeg executable',
},async()=>{
  const root=await mkdtemp(join(tmpdir(),'realityloop-offline-video-'))
  const store=join(root,'dag')
  try{
    const source=await runDagExperiment({
      kind:'modelica',
      name:'video-wheel-modelica',
      model:'RealityLoopContacts.WheelBench',
      durationSeconds:.6,
      intervalSeconds:.05,
      motorTorqueNewtonMetres:50,
      frictionCoefficient:.7,
    },{storageDirectory:store})
    const exported=await exportDagVideo(source.invocationId,{
      storageDirectory:store,outputPath:join(root,'wheel.mp4'),
      ffmpeg:ffmpeg!,
      settings:{width:480,height:270,fps:8},
    })
    const actual=await readFile(exported.outputPath)
    assert.ok(actual.length>2000)
    assert.equal(actual.subarray(4,8).toString('ascii'),'ftyp')
    assert.equal('sha256:'+createHash('sha256').update(actual).digest('base64url'),
      exported.manifest.mediaSha256)
    assert.equal(exported.manifest.sourceArtifactId,source.resultArtifactId)
    assert.equal(exported.manifest.renderMode,'timeseries')
    const backend=createLocalDagStorage(store)
    const stored=await backend.backend.readArtifact(exported.manifestArtifactId)
    assert.deepEqual(stored,exported.manifest)
    const repo=createDesignGraphRepository(backend.repositoryStore)
    const storedRun=await repo.getRun(exported.videoInvocationId,exported.invocationRunId)
    assert.ok(storedRun)
    assert.ok((await stat(join(store,exported.manifest.mediaRelativePath))).size>2000)
    const sourceUnchanged=await backend.backend.readArtifact(source.resultArtifactId)
    assert.deepEqual(sourceUnchanged,source.result)
  }finally{await rm(root,{recursive:true,force:true})}
})
