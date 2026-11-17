#!/usr/bin/env node
/** Capture the actual WebGL plant, not generated concept art. */
import {createServer} from 'vite'
import {chromium} from 'playwright'
import {fileURLToPath} from 'node:url'
import {resolve} from 'node:path'
import assert from 'node:assert/strict'

const root=fileURLToPath(new URL('../',import.meta.url))
const vite=await createServer({root,logLevel:'error',server:{
  host:'127.0.0.1',port:0,strictPort:false,
}})
let browser
try{
  await vite.listen()
  const origin=vite.resolvedUrls?.local[0]
  assert(origin)
  browser=await chromium.launch({headless:true,args:[
    ...(process.env.REALITYLOOP_CAPTURE_NO_SANDBOX==='1'?['--no-sandbox']:[]),
    ...(process.env.REALITYLOOP_CAPTURE_SWIFTSHADER==='1'?
      ['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']:[]),
  ]})
  const page=await browser.newPage({viewport:{width:1440,height:810},
    deviceScaleFactor:1})
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.goto(new URL('examples/power-plant.html',origin).href,{
    waitUntil:'domcontentloaded',timeout:60000,
  })
  await page.waitForFunction(()=>
    document.getElementById('mission-status')?.textContent?.startsWith('PASS'),
    null,{timeout:60000})
  // Afternoon sun illuminates the west-facing tracker surfaces from the
  // low service-road viewpoint rather than creating a toy aerial thumbnail.
  await page.evaluate(()=>{
    const input=document.getElementById('timeline')
    input.value='90'
    input.dispatchEvent(new Event('input',{bubbles:true}))
  })
  await page.addStyleTag({content:`
    .mission-header,.panel,.scene-caption,.stage-timeline,.stage-note
      {display:none!important}
    .mission-layout{display:block;height:100vh}
    .stage{height:100vh;min-height:0}
    .viewport{width:100vw;height:100vh;min-height:0;flex:none}
  `})
  await page.waitForTimeout(700)
  assert.deepEqual(errors,[],'Solar viewer must not throw during capture')
  const dest=resolve(root,'docs/realityloop-gallery-solar.jpg')
  await page.locator('#viewport').screenshot({
    path:dest,type:'jpeg',quality:89,
    animations:'disabled',timeout:60000,
  })
  console.log(JSON.stringify({destination:dest,status:
    await page.locator('#mission-status').innerText(),
    frame:await page.locator('#time-label').innerText(),
    energy:await page.locator('#metric-d').innerText()}))
}finally{
  await browser?.close()
  await vite.close()
}
