#!/usr/bin/env node
/** Production browser proof: the canonical GLB is loaded into the real
 * supermarket Three.js scene without changing the Modelica simulation. */
import {createRequire} from 'node:module'
import {preview} from 'vite'
import {fileURLToPath} from 'node:url'
import assert from 'node:assert/strict'

const root=fileURLToPath(new URL('../',import.meta.url))
const {chromium}=createRequire(import.meta.url)(
  process.env.REALITYLOOP_PLAYWRIGHT||'playwright')
const server=await preview({
  root,base:'/',build:{outDir:'dist-web'},
  preview:{host:'127.0.0.1',port:0,strictPort:false},
})
let browser
try{
  const origin=server.resolvedUrls?.local[0]
  assert(origin,'Production preview server unavailable')
  browser=await chromium.launch({headless:true,args:[
    ...(process.env.REALITYLOOP_CAPTURE_NO_SANDBOX==='1'?['--no-sandbox']:[]),
    ...(process.env.REALITYLOOP_CAPTURE_SWIFTSHADER==='1'
      ?['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']:[]),
  ]})
  const page=await browser.newPage({viewport:{width:960,height:560}})
  const errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  const glbRequests=[]
  page.on('response',response=>{
    if(response.url().includes('supermarket-layout')&&response.url().includes('.glb'))
      glbRequests.push(response.status())
  })
  const response=await page.goto(new URL('/examples/supermarket.html',origin).href,
    {waitUntil:'domcontentloaded',timeout:60000})
  assert.equal(response?.status(),200)
  const button=page.locator('#collision-mesh')
  await button.click()
  await page.waitForFunction(()=>
    document.querySelector('#collision-mesh')?.textContent==='Hide GLB colliders',
    null,{timeout:30000})
  assert.deepEqual(glbRequests,[200],'The actual compiled GLB must be fetched')
  assert.deepEqual(errors,[],'GLB preview must not throw JavaScript errors')
  await button.click()
  assert.equal(await button.textContent(),'Show GLB colliders')
  await button.click()
  assert.equal(await button.textContent(),'Hide GLB colliders')
  assert.deepEqual(glbRequests,[200],'The asset must be loaded once, not per toggle')
  console.log(JSON.stringify({status:'PASS',source:'canonical supermarket GLB',
    requestStatus:glbRequests[0],reused:true,errors}))
}finally{
  await browser?.close()
  await new Promise((resolve,reject)=>
    server.httpServer.close(error=>error?reject(error):resolve()))
}
