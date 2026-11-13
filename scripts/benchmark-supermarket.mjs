#!/usr/bin/env node
/** Standalone GPU/SwiftShader layer isolation. Optional Playwright dependency.
 * Pass REALITYLOOP_PLAYWRIGHT=/path/to/playwright for an external installation. */
import {createRequire} from 'node:module'
import {createServer} from 'vite'
import {writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {tmpdir} from 'node:os'

const require=createRequire(import.meta.url)
const {chromium}=require(process.env.REALITYLOOP_PLAYWRIGHT || 'playwright')
const root=fileURLToPath(new URL('../',import.meta.url))
const output=process.env.REALITYLOOP_BENCH_OUTPUT ||
  resolve(tmpdir(),'realityloop-render-benchmark.json')
const durationMs=Number(process.env.REALITYLOOP_BENCH_DURATION_MS || '4000')
if(!Number.isInteger(durationMs)||durationMs<1000||durationMs>30000){
  throw Error('REALITYLOOP_BENCH_DURATION_MS must be 1000–30000')
}
const configs=[
  ['empty',{quality:'high',pixelRatio:1,room:false,rack:false,ceiling:false}],
  ['performance-0.48',{quality:'performance',pixelRatio:.48}],
  ['performance-1.0',{quality:'performance',pixelRatio:1}],
  ['performance-original-arch',{quality:'performance',pixelRatio:.48,architecturePbr:true}],
  ['performance-no-contact',{quality:'performance',pixelRatio:.48,contactShadows:false}],
  ['balanced-0.7',{quality:'balanced',pixelRatio:.7}],
  ['balanced-1.0',{quality:'balanced',pixelRatio:1}],
  ['high-1.0',{quality:'high',pixelRatio:1}],
  ['high-0.48',{quality:'high',pixelRatio:.48}],
  ['high-no-shadow',{quality:'high',pixelRatio:1,shadows:false}],
  ['high-no-floor',{quality:'high',pixelRatio:1,floor:false}],
  ['high-no-stock',{quality:'high',pixelRatio:1,products:false}],
  ['high-lambert-stock',{quality:'high',pixelRatio:1,lambertStock:true}],
  ['high-no-room',{quality:'high',pixelRatio:1,room:false}],
  ['high-no-rack',{quality:'high',pixelRatio:1,rack:false}],
  ['high-no-ceiling',{quality:'high',pixelRatio:1,ceiling:false}],
  ['high-unlit',{quality:'high',pixelRatio:1,unlit:true}],
  ['high-lambert-all',{quality:'high',pixelRatio:1,lambertAll:true}],
  ['high-0.48-no-shadow',{quality:'high',pixelRatio:.48,shadows:false}],
  ['high-repeat',{quality:'high',pixelRatio:1}],
  ['performance-repeat',{quality:'performance',pixelRatio:.48}],
]
const selected=new Set((process.env.REALITYLOOP_BENCH_CASES || '')
  .split(',').map(name=>name.trim()).filter(Boolean))
const activeConfigs=selected.size?configs.filter(([name])=>selected.has(name)):configs
if(selected.size&&activeConfigs.length!==selected.size){
  throw Error('Unknown benchmark case: '+[...selected]
    .filter(name=>!configs.some(([candidate])=>candidate===name)).join(', '))
}
const vite=await createServer({
  root,
  server:{host:'127.0.0.1',port:0,strictPort:false},
  logLevel:'error',
})
let browser
try{
  await vite.listen()
  const origin=vite.resolvedUrls?.local[0]
  if(!origin)throw Error('Vite did not announce its URL')
  browser=await chromium.launch({
    headless:true,
    executablePath:process.env.REALITYLOOP_CHROMIUM || undefined,
    args:[
      ...(process.env.REALITYLOOP_BENCH_NO_SANDBOX==='1'?['--no-sandbox']:[]),
      ...(process.env.REALITYLOOP_BENCH_SWIFTSHADER==='1'?['--enable-unsafe-swiftshader']:[]),
    ],
  })
  const page=await browser.newPage({
    viewport:{width:1100,height:650},deviceScaleFactor:1,
  })
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.goto(new URL('benchmarks/supermarket.html',origin).href)
  await page.waitForFunction(()=>window.__realityloopRenderBenchmark)
  const results=[]
  for(const [name,options] of activeConfigs){
    const result=await page.evaluate(
      ({options,durationMs})=>window.__realityloopRenderBenchmark.measure(options,durationMs),
      {options,durationMs},
    )
    const row={name,...result}
    results.push(row)
    console.log(name.padEnd(24),
      result.fps.toFixed(2).padStart(7)+' RAF FPS',
      result.renderSubmissionMedianMs.toFixed(1).padStart(7)+' ms CPU submit',
      Math.round(result.averageDraws)+' draws')
  }
  const report={
    date:new Date().toISOString(),
    viewport:{width:1100,height:650},
    note:'RAF presentation pacing and JS submission; static interior only, no Modelica or SLAM. Headless software renderer does not predict hardware GPU FPS.',
    errors,results,
  }
  await writeFile(output,JSON.stringify(report,null,2))
  console.log('Results:',output)
  if(errors.length)console.warn('Browser errors:',errors)
}finally{
  await browser?.close()
  await vite.close()
}
