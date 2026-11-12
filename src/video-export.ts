import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { copyFile, mkdir, readFile, rename, rm, stat } from 'node:fs/promises'
import { spawn, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createLocalDagStorage } from './dag-storage.ts'
import {
  canonicalHash, createNode, createGraphRevision, createInvocationDefinition,
  createInvocationRun, createProjectRevision, createDesignGraphRepository,
  resolveInvocationPolicy, type DagHash,
} from './vendor/taskyon-comp-dag.mjs'
import {
  prepareVideoTrack, renderVideoFrame, validateVideoSettings,
  type VideoSettings, type VideoTrack,
} from './video-render.ts'

const execFileAsync=promisify(execFile)
const hash=(bytes:Buffer|string):DagHash=>
  ('sha256:'+createHash('sha256').update(bytes).digest('base64url')) as DagHash

const openObject={type:'object',additionalProperties:true} as const
const paramsSchema={
  type:'object',
  properties:{
    sourceArtifactId:{type:'string'},
    sourceInvocationId:{type:'string'},
    sourceRunId:{type:'string'},
    settings:{
      type:'object',
      properties:{fps:{type:'number'},width:{type:'number'},height:{type:'number'}},
      required:['fps','width','height'],
      additionalProperties:false,
    },
    encoderVersion:{type:'string'},
    rendererHash:{type:'string'},
  },
  required:['sourceArtifactId','sourceInvocationId','sourceRunId','settings','encoderVersion','rendererHash'],
  additionalProperties:false,
} as const
type StoredRun={
  id:DagHash
  invocationId:DagHash
  status:'completed'|'failed'|'cancelled'
  artifacts:Record<string,{id:DagHash}>
  provenance?:Record<string,unknown>
}
type Recorded={
  sourceArtifactId:DagHash
  sourceRunId:DagHash
  result:unknown
  sourceGraphRevisionId:DagHash
  sourceNodes:Record<string,DagHash>
}
type VideoParams={
  sourceArtifactId:DagHash
  sourceInvocationId:DagHash
  sourceRunId:DagHash
  settings:VideoSettings
  encoderVersion:string
  rendererHash:DagHash
}

export type VideoManifest=Readonly<{
  schema:'realityloop.video-export/v1'
  sourceInvocationId:DagHash
  sourceRunId:DagHash
  sourceArtifactId:DagHash
  mediaSha256:DagHash
  mediaRelativePath:string
  bytes:number
  frameCount:number
  fps:number
  width:number
  height:number
  durationSeconds:number
  rendererHash:DagHash
  encoderVersion:string
  codec:'h264'
  renderMode:VideoTrack['mode']
}>
export type VideoExportResult=Readonly<{
  outputPath:string
  manifest:VideoManifest
  manifestArtifactId:DagHash
  videoInvocationId:DagHash
  graphRevisionId:DagHash
  invocationRunId:DagHash
  projectRevisionId:DagHash
}>

/** Streaming FFmpeg encoder. No DOM/canvas/Chromium and no intermediate frames.
 * Frames are sampled from a *stored* trajectory; Modelica is never called.
 */
export const encodeFrames=async(
  track:VideoTrack,settings:VideoSettings,ffmpeg:string,outputPath:string,
):Promise<void>=>{
  const frameCount=validateVideoSettings(settings,track)
  const args=[
    '-hide_banner','-loglevel','error','-nostdin','-y',
    '-f','rawvideo','-pixel_format','rgb24',
    '-video_size',settings.width+'x'+settings.height,
    '-framerate',String(settings.fps),'-i','pipe:0',
    '-an','-c:v','libx264','-threads','1',
    '-preset','veryfast','-crf','22','-pix_fmt','yuv420p',
    '-map_metadata','-1','-movflags','+faststart',
    '-metadata','creation_time=1970-01-01T00:00:00Z',
    outputPath,
  ]
  const child=spawn(ffmpeg,args,{stdio:['pipe','ignore','pipe']})
  let errors=''
  child.stderr.on('data',(chunk:Buffer)=>{
    errors=(errors+chunk.toString()).slice(-4096)
  })
  const completed=new Promise<void>((accept,reject)=>{
    child.once('error',error=>reject(
      new Error('FFmpeg unavailable ('+ffmpeg+'): '+error.message+
        '. Install ffmpeg (on NixOS: nix shell nixpkgs#ffmpeg) or pass --ffmpeg PATH.')))
    child.once('close',(code,signal)=>{
      if(code===0)accept()
      else reject(Error('FFmpeg failed ('+(signal??code)+'): '+errors))
    })
  })
  const frames=Readable.from((async function*(){
    for(let i=0;i<frameCount;i++)yield renderVideoFrame(track,settings,i)
  })())
  try{
    await pipeline(frames,child.stdin)
    await completed
  }catch(error){
    if(child.exitCode===null)child.kill('SIGKILL')
    await completed.catch(()=>undefined)
    throw error
  }
}
const fileHash=async(path:string):Promise<DagHash>=>{
  const digest=createHash('sha256')
  for await(const chunk of createReadStream(path))digest.update(chunk)
  return ('sha256:'+digest.digest('base64url')) as DagHash
}

export const resolveRecordedRun=async(
  invocationId:DagHash,storeDir:string,
):Promise<Recorded>=>{
  const store=createLocalDagStorage(storeDir)
  const repo=createDesignGraphRepository(store.repositoryStore)
  await repo.getInvocation(invocationId)
  const runs=(await repo.listRuns(invocationId)) as StoredRun[]
  const completed=runs.filter(run=>run.status==='completed'&&run.artifacts.simulation?.id)
    .sort((a,b)=>a.id.localeCompare(b.id))
  if(!completed.length)throw Error('No completed simulation artifact for invocation '+invocationId)
  const sourceArtifactId=completed[0]!.artifacts.simulation!.id
  if(completed.some(run=>run.artifacts.simulation?.id!==sourceArtifactId)){
    throw Error('Conflicting simulation artifacts for one recorded invocation')
  }
  const result=await store.backend.readArtifact(sourceArtifactId)
  const provenance=completed[0]!.provenance??{}
  if(typeof provenance.graphRevisionId!=='string'){
    throw Error('Source DAG run is missing graph revision provenance')
  }
  const graph=await repo.getGraphRevision(provenance.graphRevisionId as DagHash) as {
    id:DagHash;nodes:Record<string,DagHash>
  }
  return {
    result,sourceArtifactId,sourceRunId:completed[0]!.id,
    sourceGraphRevisionId:graph.id,sourceNodes:graph.nodes,
  }
}

/** Exports a derived Taskyon DAG video from recorded immutable simulation
 * artifacts. All media are immutable hashed files; the DAG artifact contains
 * a portable manifest pointing to the exact bytes inside the local store.
 */
export const exportDagVideo=async(
  sourceInvocationId:DagHash,
  options:{
    outputPath:string
    storageDirectory?:string
    ffmpeg?:string
    settings?:VideoSettings
  },
):Promise<VideoExportResult>=>{
  const storeDir=resolve(options.storageDirectory??join(process.cwd(),'runs/.dag'))
  const outputPath=resolve(options.outputPath)
  const ffmpeg=options.ffmpeg??'ffmpeg'
  const settings=options.settings??{fps:15,width:960,height:540}
  const source=await resolveRecordedRun(sourceInvocationId,storeDir)
  const track=prepareVideoTrack(source.result)
  validateVideoSettings(settings,track)
  const {stdout:version}=await execFileAsync(ffmpeg,['-version'],{timeout:15_000})
    .catch(error=>{
      throw Error('Cannot run FFmpeg ('+ffmpeg+'): '+String(error)+
        '. On NixOS: nix shell nixpkgs#ffmpeg; or pass --ffmpeg PATH.')
    })
  const encoderVersion=version.split('\n')[0]??'unknown'
  const rendererHash=hash(await readFile(resolve(fileURLToPath(new URL('.',import.meta.url)),'../src/video-render.ts')))
  const params:VideoParams={
    sourceArtifactId:source.sourceArtifactId,
    sourceInvocationId,
    sourceRunId:source.sourceRunId,
    settings,rendererHash,encoderVersion,
  }
  const store=createLocalDagStorage(storeDir)
  const repo=createDesignGraphRepository(store.repositoryStore)
  const sourceNode=createNode<VideoParams,Record<string,unknown>>({
    name:'RealityLoop.RecordedSimulation',version:1,
    contentHash:canonicalHash({kind:'RealityLoop.RecordedSimulation',version:1}),
    effect:'source',policy:{cache:'NoCache',scope:'Environment'},
    localParams:paramsSchema,outputSchema:openObject,
    run:async p=>store.backend.readArtifact(p.sourceArtifactId),
  })
  const videoNode=createNode<VideoParams,VideoManifest>({
    name:'RealityLoop.OfflineVideo',version:1,
    contentHash:canonicalHash({kind:'RealityLoop.OfflineVideo',version:1,rendererHash}),
    effect:'source',policy:{cache:'NoCache',scope:'Environment'},
    localParams:paramsSchema,outputSchema:openObject,
    hiddenInputs:{simulation:sourceNode},
    run:async(p,use)=>{
      const simulation=await use.simulation(p)
      const current=prepareVideoTrack(simulation)
      const mediaDir=join(storeDir,'media')
      await mkdir(mediaDir,{recursive:true})
      const temporary=join(mediaDir,'.render-'+randomUUID()+'.mp4')
      try{
        await encodeFrames(current,p.settings,ffmpeg,temporary)
        const mediaSha256=await fileHash(temporary)
        const mediaRelativePath='media/'+mediaSha256.replace(':','_')+'.mp4'
        const mediaPath=join(storeDir,mediaRelativePath)
        const existing=await stat(mediaPath).catch((error:unknown)=>{
          if(error&&typeof error==='object'&&'code' in error&&error.code==='ENOENT')return null
          throw error
        })
        if(existing){
          if(await fileHash(mediaPath)!==mediaSha256)throw Error('Video media store corruption')
        }else{
          await rename(temporary,mediaPath)
        }
        return {
          schema:'realityloop.video-export/v1' as const,
          sourceInvocationId:p.sourceInvocationId,
          sourceRunId:p.sourceRunId,
          sourceArtifactId:p.sourceArtifactId,
          mediaSha256,mediaRelativePath,
          bytes:(await stat(mediaPath)).size,
          frameCount:validateVideoSettings(p.settings,current),
          fps:p.settings.fps,width:p.settings.width,height:p.settings.height,
          durationSeconds:current.durationSeconds,
          rendererHash:p.rendererHash,encoderVersion:p.encoderVersion,
          codec:'h264' as const,renderMode:current.mode,
        }
      }finally{await rm(temporary,{force:true})}
    },
  })
  const graph=createGraphRevision({
    parents:[source.sourceGraphRevisionId],
    nodes:{...source.sourceNodes,
      recordedSimulation:sourceNode.contentHash!,
      video:videoNode.contentHash!},
  })
  const invocation=createInvocationDefinition({
    rootNodeId:videoNode.contentHash!,
    variables:{
      sourceArtifactId:{kind:'constant',value:source.sourceArtifactId},
      sourceInvocationId:{kind:'constant',value:sourceInvocationId},
      sourceRunId:{kind:'constant',value:source.sourceRunId},
      settings:{kind:'constant',value:settings},
      rendererHash:{kind:'constant',value:rendererHash},
      encoderVersion:{kind:'constant',value:encoderVersion},
    },inputs:{},objectives:[],constraints:[],capture:[],
    policy:{accuracy:'exact'},reducerOverrides:{},
  })
  const result=await videoNode.call(params).run(
    {nowUtcMs:Date.now(),log:()=>undefined},
    {execution:{mode:'local'},storageBackend:store.backend},
  )
  // Pin the derived invocation without changing the source simulation.
  const manifest=result.value
  const manifestArtifactId=result.artifactHash
  const started=Date.now()
  const run=createInvocationRun({
    invocationId:invocation.id,
    resolvedPolicy:resolveInvocationPolicy(invocation),
    status:'completed',startedAtMs:started,completedAtMs:Date.now(),
    artifacts:{
      video:{id:manifestArtifactId,mediaType:'application/json'},
      simulation:{id:source.sourceArtifactId,mediaType:'application/json'},
      media:{id:manifest.mediaSha256,mediaType:'video/mp4',size:manifest.bytes},
    },
    provenance:{
      kind:'RealityLoop.OfflineVideo',
      sourceInvocationId,
      sourceRunId:source.sourceRunId,
      sourceArtifactId:source.sourceArtifactId,
      parentGraphRevisionId:source.sourceGraphRevisionId,
      rendererHash,
      encoderVersion,
      mediaRelativePath:manifest.mediaRelativePath,
      execution:'local',
      transport:'none',
    },
  })
  await repo.putGraphRevision(graph)
  await repo.putInvocation(invocation)
  await repo.putRun(run)
  const previous=await repo.getProjectRef('projects/realityloop')
  const projectBefore=previous?await repo.getProjectRevision(previous.revisionId) as {
    id:DagHash;invocations:Record<string,DagHash>
  }:null
  const projectRevisionId=projectBefore?.invocations[invocation.id]===invocation.id
    ? projectBefore.id
    :await (async()=>{
      const project=createProjectRevision({
        parents:projectBefore?[projectBefore.id]:[],
        displayName:'RealityLoop local experiments',
        invocations:{...(projectBefore?.invocations??{}),[invocation.id]:invocation.id},
        extensions:{},
      })
      await repo.putProjectRevision(project)
      await repo.advanceProjectRef({
        name:'projects/realityloop',revisionId:project.id,
        expected:previous?.revisionId??null,
      })
      return project.id
    })()
  const mediaPath=join(storeDir,manifest.mediaRelativePath)
  const tempOutput=outputPath+'.part-'+randomUUID()
  await mkdir(dirname(outputPath),{recursive:true})
  try{
    await copyFile(mediaPath,tempOutput)
    await rename(tempOutput,outputPath)
  }finally{await rm(tempOutput,{force:true})}
  return {outputPath,manifest,manifestArtifactId,graphRevisionId:graph.id,
    videoInvocationId:invocation.id,invocationRunId:run.id,projectRevisionId}
}
