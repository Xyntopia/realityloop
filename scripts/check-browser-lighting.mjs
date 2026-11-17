#!/usr/bin/env node
import {createRequire} from 'node:module'
import {createServer} from 'vite'
import {fileURLToPath} from 'node:url'
import {resolve} from 'node:path'
import assert from 'node:assert/strict'

const {chromium}=createRequire(import.meta.url)(
  process.env.REALITYLOOP_PLAYWRIGHT || 'playwright')
const root=fileURLToPath(new URL('../',import.meta.url))
const vite=await createServer({root,logLevel:'error',
  server:{host:'127.0.0.1',port:0,strictPort:false}})
let browser
try{
  await vite.listen()
  const origin=vite.resolvedUrls?.local[0]
  assert(origin,'Vite server not ready')
  browser=await chromium.launch({
    headless:true,
    executablePath:process.env.REALITYLOOP_CHROMIUM||undefined,
    args: [
      ...(process.env.REALITYLOOP_CAPTURE_NO_SANDBOX==='1'?['--no-sandbox']:[]),
      ...(process.env.REALITYLOOP_CAPTURE_SWIFTSHADER==='1'
        ?['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']:[]),
    ],
  })
  const page=await browser.newPage({viewport:{width:1160,height:720},deviceScaleFactor:1})
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.goto(new URL('examples/supermarket.html',origin).href,
    {waitUntil:'domcontentloaded',timeout:60000})
  await page.locator('#visual-quality').waitFor()
  const results=[]
  for(const quality of ['balanced','high','performance']){
    await page.selectOption('#visual-quality',quality)
    await page.waitForFunction(q=>
      document.getElementById('render-stats')?.textContent?.includes(q.toUpperCase()),
      quality,{timeout:25000})
    results.push({
      quality,stats:await page.locator('#render-stats').textContent(),
    })
    if(quality==='balanced'){
      await page.locator('#aisle-camera').click()
      await page.locator('#presentation').click()
      if(process.env.WINX_TEMP_DIR)
        await page.screenshot({path:resolve(process.env.WINX_TEMP_DIR,'realityloop-lighting-smoke.png'),timeout:60000})
    }
  }
  const logoResponse=await page.request.get(new URL('realityloop-icon.svg',origin).href)
  assert.equal(logoResponse.status(),200)
  const logo=await logoResponse.text()
  assert(!/<rect[^>]+fill="#ffffff"/.test(logo),'Favicon has opaque white background')
  console.log(JSON.stringify({qualities:results,errors},null,2))
  assert.deepEqual(errors,[])
}finally{
  await browser?.close()
  await vite.close()
}
