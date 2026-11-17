#!/usr/bin/env node
/**
 * Reproducible example-gallery thumbnails from the actual running app.
 * Never use external photographs, mocked charts, or loading-state screenshots.
 */
import {createServer} from 'vite'
import {chromium} from 'playwright'
import {fileURLToPath} from 'node:url'
import {resolve} from 'node:path'
import {mkdir} from 'node:fs/promises'
import assert from 'node:assert/strict'

const root=fileURLToPath(new URL('../',import.meta.url))
const docs=resolve(root,'docs')
const server=await createServer({
  root,logLevel:'error',server:{host:'127.0.0.1',port:0,strictPort:false},
})
let browser
try{
  await server.listen()
  const origin=server.resolvedUrls?.local[0]
  assert(origin,'Vite server URL is unavailable')
  browser=await chromium.launch({
    headless:true,
    executablePath:process.env.REALITYLOOP_CHROMIUM||undefined,
    args:[
      ...(process.env.REALITYLOOP_CAPTURE_NO_SANDBOX==='1'?['--no-sandbox']:[]),
      ...(process.env.REALITYLOOP_CAPTURE_SWIFTSHADER==='1'
        ?['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']:[]),
    ],
  })
  await mkdir(docs,{recursive:true})
  const results=[]
  const screenshot=async(page,name)=>{
    const path=resolve(docs,name)
    await page.screenshot({path,type:'jpeg',quality:84,timeout:60000,
      animations:'disabled'})
    return path
  }
  const viewport={width:1440,height:810}
  {
    const page=await browser.newPage({viewport,deviceScaleFactor:1})
    const errors=[]
    page.on('pageerror',error=>errors.push(error.message))
    try{
      await page.goto(new URL('examples/supermarket.html',origin).href,
        {waitUntil:'domcontentloaded',timeout:60000})
      await page.waitForFunction(()=>{
        const status=document.getElementById('status')?.textContent??''
        return status.startsWith('SIMULATING')||status.startsWith('COMPLETE')
      },null,{timeout:180000})
      await page.selectOption('#visual-quality','balanced')
      await page.waitForFunction(()=>{
        const frame=document.getElementById('frame')?.textContent??''
        return /^SAMPLE \d+/.test(frame)
      },null,{timeout:45000})
      await page.waitForTimeout(700)
      assert.deepEqual(errors,[],'Supermarket page errors')
      results.push({example:'supermarket',path:await screenshot(page,
        'realityloop-gallery-supermarket.jpg'),
        status:await page.locator('#status').textContent()})
    }finally{await page.close()}
  }
  {
    const page=await browser.newPage({viewport,deviceScaleFactor:1})
    const errors=[]
    page.on('pageerror',error=>errors.push(error.message))
    try{
      await page.goto(new URL('drive-lab.html',origin).href,
        {waitUntil:'domcontentloaded',timeout:60000})
      await page.waitForFunction(()=>{
        const status=document.getElementById('status')?.textContent??''
        return status.startsWith('PASS')||status.startsWith('FAILED')
      },null,{timeout:180000})
      const status=await page.locator('#status').textContent()
      assert(status?.startsWith('PASS'),status)
      assert.deepEqual(errors,[],'Traction laboratory page errors')
      await page.waitForTimeout(350)
      results.push({example:'traction',path:await screenshot(page,
        'realityloop-gallery-traction.jpg'),status})
    }finally{await page.close()}
  }
  console.log(JSON.stringify({source:'RealityLoop browser app',viewport,results},null,2))
}finally{
  await browser?.close()
  await server.close()
}
