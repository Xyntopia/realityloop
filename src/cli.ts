#!/usr/bin/env node
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { realityLoopExamples } from './examples.ts'
import { runDagExperiment } from './dag.ts'
import { createRunIntegrityReceipt } from './integrity.ts'

const main = async () => {
  const [input, outputDir = 'runs/latest'] = process.argv.slice(2)
  if (input === 'examples') {
    process.stdout.write(JSON.stringify(realityLoopExamples, null, 2) + '\n')
    return
  }
  if (input === 'verify') {
    const [id, storeDirectory = 'runs/.dag'] = process.argv.slice(3)
    if (!id || !/^sha256:[A-Za-z0-9_-]{43}$/.test(id)) {
      throw Error('Usage: realityloop verify <invocation-id> [DAG-store-directory]')
    }
    const { verifyDagReplay } = await import('./dag-verify.ts')
    const verified = await verifyDagReplay(id as `sha256:${string}`, {
      storageDirectory: storeDirectory,
    })
    process.stdout.write(JSON.stringify(verified, null, 2) + '\n')
    return
  }
  if (input === 'video') {
    const [id, output, ...flags] = process.argv.slice(3)
    if (!id || !/^sha256:[A-Za-z0-9_-]{43}$/.test(id) || !output) {
      throw Error('Usage: realityloop video <invocation-id> <output.mp4> [--fps 15] [--size 960x540] [--store runs/.dag] [--ffmpeg /path/to/ffmpeg]')
    }
    const argumentsByName = new Map<string,string>()
    for (let i=0;i<flags.length;i+=2) {
      const key=flags[i], value=flags[i+1]
      if (!key || !['--fps','--size','--store','--ffmpeg'].includes(key) || !value) {
        throw Error('Invalid video argument '+String(key))
      }
      if (argumentsByName.has(key)) throw Error('Duplicate video argument '+key)
      argumentsByName.set(key,value)
    }
    const size=argumentsByName.get('--size')??'960x540'
    if (!/^[0-9]+x[0-9]+$/.test(size)) throw Error('Invalid video size, expected WIDTHxHEIGHT')
    const [width,height]=size.split('x').map(Number)
    const fps=Number(argumentsByName.get('--fps')??'15')
    const {exportDagVideo}=await import('./video-export.ts')
    const {manifest,manifestArtifactId,videoInvocationId,invocationRunId,outputPath}=await exportDagVideo(
      id as `sha256:${string}`,{
        outputPath:output,
        settings:{fps,width:width!,height:height!},
        ...(argumentsByName.has('--ffmpeg')?{ffmpeg:argumentsByName.get('--ffmpeg')}:{}),
        ...(argumentsByName.has('--store')?{storageDirectory:argumentsByName.get('--store')}:{}),
      },
    )
    process.stdout.write(JSON.stringify({
      output:outputPath,
      videoSha256:manifest.mediaSha256,
      manifestArtifactId,
      videoInvocationId,
      videoRunId:invocationRunId,
      sourceInvocationId:manifest.sourceInvocationId,
      frames:manifest.frameCount,
      resolution:manifest.width+'x'+manifest.height,
      fps:manifest.fps,
      durationSeconds:manifest.durationSeconds,
    },null,2)+'\n')
    return
  }
  if (!input) {
    throw new Error('Usage: realityloop <scenario.json> [output-directory] | realityloop examples | realityloop verify <invocation-id> [store-directory] | realityloop video <invocation-id> <output.mp4>')
  }
  const bytes = await readFile(resolve(input))
  const raw: unknown = JSON.parse(bytes.toString('utf8'))
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw Error('Scenario must be an object')
  }
  const execution = await runDagExperiment(raw as Record<string,unknown>)
  const result = execution.result
  const resultBytes = Buffer.from(JSON.stringify(result, null, 2) + '\n')
  const receipt = await createRunIntegrityReceipt(bytes, resultBytes, result, undefined, raw)
  const destination = resolve(outputDir)
  await mkdir(destination, { recursive: true })
  await Promise.all([
    writeFile(join(destination,'sensor-observations.json'),
      JSON.stringify(execution.sensorObservations,null,2)+'\n'),
    writeFile(join(destination, 'result.json'), resultBytes),
    writeFile(join(destination, 'run-integrity.json'), JSON.stringify({
      ...receipt,
      dag:{
        schema:'taskyon-design-graph/v2',
        graphRevisionId:execution.graphRevisionId,
        invocationId:execution.invocationId,
        invocationRunId:execution.invocationRunId,
        projectRevisionId:execution.projectRevisionId,
        resultArtifactId:execution.resultArtifactId,
        metricsArtifactId:execution.metricsArtifactId,
        sensorArtifactId:execution.sensorArtifactId,
        nodes:execution.nodes,
        sourceLock:execution.lock,
      },
    }, null, 2) + '\n'),
  ])
  process.stdout.write(JSON.stringify({
    scenario: result.scenario.name,
    status: result.result.passed ? 'passed' : 'failed',
    output: join(destination, 'result.json'),
    receipt: join(destination, 'run-integrity.json'),
    dagInvocationId: execution.invocationId,
    dagRunId: execution.invocationRunId,
    resultArtifactId: execution.resultArtifactId,
    engine: result.engine.name,
  }) + '\n')
  if (!result.result.passed) process.exitCode = 1
}
main().catch((error: unknown) => {
  process.stderr.write(String(error) + '\n')
  process.exitCode = 2
})
