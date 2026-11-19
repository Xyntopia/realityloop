#!/usr/bin/env node
/** Production browser acceptance for the GLB triangle-mesh Modelica contact
 * solver, including both the safe route and blocked contact-force regression. */
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
  assert(origin,'No production preview URL')
  browser=await chromium.launch({headless:true,args:[
    ...(process.env.REALITYLOOP_CAPTURE_NO_SANDBOX==='1'?['--no-sandbox']:[]),
    ...(process.env.REALITYLOOP_CAPTURE_SWIFTSHADER==='1'
      ?['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']:[]),
  ]})
  const page=await browser.newPage({viewport:{width:960,height:560}})
  const errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  const response=await page.goto(new URL('/examples/supermarket.html',origin).href,
    {waitUntil:'domcontentloaded',timeout:60000})
  assert.equal(response?.status(),200)
  await page.locator('#scene canvas').waitFor({timeout:30000})
  await page.selectOption('#speed','8')
  await page.selectOption('#engine','modelica-mesh')
  await page.waitForFunction(()=>
    (document.querySelector('#engine-label')?.textContent||'').includes('IMPORTED GLB MESH'),
    null,{timeout:90000})
  await page.waitForFunction(()=>
    (document.querySelector('#status')?.textContent||'').startsWith('COMPLETE'),
    null,{timeout:90000})
  assert.match(await page.locator('#status').textContent()||'',/GOAL REACHED/)
  const detourFrame=await page.locator('#frame').textContent()
  assert.match(detourFrame||'',/SAMPLE \d+ \/ \d+/)
  await page.selectOption('#route','blocked')
  await page.waitForFunction(()=>
    (document.querySelector('#status')?.textContent||'').startsWith('FAILED'),
    null,{timeout:90000})
  assert.match(await page.locator('#status').textContent()||'',/ROUTE BLOCKED/)
  assert.deepEqual(errors,[],'Mesh-backed Modelica production simulation must not crash')
  console.log(JSON.stringify({result:'PASS',engine:'Modelica / compiled GLB triangles',
    detourFrame,blocked:'FAILED · ROUTE BLOCKED',errors}))
}finally{
  await browser?.close()
  await new Promise((resolve,reject)=>
    server.httpServer.close(err=>err?reject(err):resolve()))
}
