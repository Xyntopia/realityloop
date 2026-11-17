#!/usr/bin/env node
/** Check the actual minified GitHub Pages solar example and its controls. */
import {preview} from 'vite'
import {chromium} from 'playwright'
import assert from 'node:assert/strict'
const server=await preview({root:process.cwd(),base:'/',
  build:{outDir:'dist-web'},preview:{host:'127.0.0.1',port:0}})
let browser
try{
  browser=await chromium.launch({headless:true,args:[
    ...(process.env.REALITYLOOP_CAPTURE_NO_SANDBOX==='1'?['--no-sandbox']:[]),
    ...(process.env.REALITYLOOP_CAPTURE_SWIFTSHADER==='1'
      ?['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']:[]),
  ]})
  const page=await browser.newPage({viewport:{width:1220,height:760}})
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  const origin=server.resolvedUrls?.local[0]
  assert(origin)
  const response=await page.goto(
    new URL('/examples/power-plant.html',origin).href,
    {waitUntil:'domcontentloaded',timeout:60000})
  assert.equal(response?.status(),200)
  await page.waitForFunction(()=>
    document.getElementById('mission-status')?.textContent?.startsWith('PASS'),
    null,{timeout:90000})
  assert.equal(await page.locator('#viewport canvas').count(),1)
  assert.match(await page.locator('#plant-summary').innerText(),/192 PV tables/)
  const firstHash=await page.locator('#artifact-id').innerText()
  assert.notEqual(firstHash,'—')
  // Vary day and camera independently: scene controls must not mutate
  // the underlying simulation or lose WebGL context.
  for(const camera of ['overview','yard','inspection'])
    await page.selectOption('#view-mode',camera)
  await page.locator('#timeline').evaluate(input=>{
    input.value='72';input.dispatchEvent(new Event('input',{bubbles:true}))
  })
  assert.equal(await page.locator('#time-label').innerText(),'12:00')
  const oldExport=await page.locator('#metric-a').innerText()
  await page.locator('#export-limit').evaluate(input=>{
    input.value='1200';input.dispatchEvent(new Event('input',{bubbles:true}))
  })
  await page.locator('#simulate').click()
  await page.waitForFunction(previous=>
    document.getElementById('artifact-id')?.textContent!==previous
    && document.getElementById('mission-status')?.textContent?.startsWith('PASS'),
    firstHash,{timeout:90000})
  const newExport=await page.locator('#metric-a').innerText()
  assert.notEqual(oldExport,newExport,
    'Grid export limit must affect the physical output')
  assert.equal(newExport,'1,200 kW')
  await page.selectOption('#tracker-mode','fixed')
  await page.waitForFunction(()=>
    document.getElementById('mission-status')?.textContent?.startsWith('PASS'),
    null,{timeout:90000})
  await page.locator('#storage-enabled').uncheck()
  await page.waitForFunction(()=>
    document.getElementById('mission-status')?.textContent?.startsWith('PASS'),
    null,{timeout:90000})
  assert.deepEqual(errors,[])
  console.log(JSON.stringify({
    solar:'PASS',pvTables:192,exportBefore:oldExport,exportAfter:newExport,
    cameraPresets:3,browserErrors:errors,
  }))
  await page.close()
}finally{
  await browser?.close()
  await new Promise((resolve,reject)=>server.httpServer.close(error=>
    error?reject(error):resolve()))
}
