#!/usr/bin/env node
/** Real minified Vite custom-domain-root browser acceptance.
 * Dev Vite alone cannot detect pcl.js constructor-name minification. */
import {createRequire} from 'node:module'
import {preview} from 'vite'
import {fileURLToPath} from 'node:url'
import assert from 'node:assert/strict'

const root=fileURLToPath(new URL('../',import.meta.url))
const {chromium}=createRequire(import.meta.url)(
  process.env.REALITYLOOP_PLAYWRIGHT || 'playwright')
const server=await preview({
  root,base:'/',build:{outDir:'dist-web'},
  preview:{host:'127.0.0.1',port:0,strictPort:false},
})
let browser
try{
  const origin=server.resolvedUrls?.local[0]
  assert(origin,'Production preview server unavailable')
  browser=await chromium.launch({
    headless:true,args:[
      ...(process.env.REALITYLOOP_CAPTURE_NO_SANDBOX==='1'?['--no-sandbox']:[]),
      ...(process.env.REALITYLOOP_CAPTURE_SWIFTSHADER==='1'
        ?['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']:[]),
    ],
  })
  const page=await browser.newPage({viewport:{width:960,height:560}})
  const errors=[],geometryWarnings=[],pclWarnings=[],areaLightRequests=[],gtaoRequests=[]
  page.on('request',request=>{
    if(request.url().includes('RectAreaLightUniformsLib'))
      areaLightRequests.push(request.url())
    if(request.url().includes('GTAOPass'))
      gtaoRequests.push(request.url())
  })
  page.on('pageerror',error=>errors.push(error.message))
  page.on('console',msg=>{
    const content=msg.text()
    if(content.includes('Buffer size too small for points data'))geometryWarnings.push(content)
    if(content.includes('PCL ICP')&&/failed|failure/.test(content))pclWarnings.push(content)
  })
  const response=await page.goto(new URL('/examples/supermarket.html',origin).href,
    {waitUntil:'domcontentloaded',timeout:60000})
  assert.equal(response?.status(),200,'Built supermarket HTML must load at /examples/supermarket.html')
  await page.locator('#graphics-effects summary').click()
  await page.selectOption('#visual-quality','high')
  assert.equal(await page.locator('#graphics-detail').inputValue(),'high')
  assert.equal(await page.locator('#fx-reflections').isChecked(),true)
  assert.equal(await page.locator('#fx-lighting').isChecked(),true)
  assert.equal(await page.locator('#ao-method').inputValue(),'ssao',
    'SSAO remains the conservative default pending real hardware comparison')
  if(await page.locator('body').evaluate(el=>el.classList.contains('software-renderer'))){
    assert.equal(await page.locator('#fx-ambientOcclusion').isDisabled(),true,
      'SSAO must not run under software Chromium')
    assert.deepEqual(areaLightRequests,[],
      'Realistic must not download the expensive area-light LUT on software renderers')
    assert.equal(await page.locator('#ao-method').isDisabled(),true)
    assert.deepEqual(gtaoRequests,[],
      'Software Chromium must never load dynamic GTAO in production')
  }
  await page.selectOption('#visual-quality','balanced')
  assert.equal(await page.locator('#fx-ambientOcclusion').isChecked(),false)
  await page.locator('#fx-lighting').uncheck()
  assert.equal(await page.locator('#visual-quality').inputValue(),'custom')
  assert.equal(await page.locator('#fx-glare').isChecked(),false)
  assert.equal(await page.locator('#fx-glare').isDisabled(),true)
  await page.locator('#fx-lighting').check()
  await page.locator('#fx-glare').check()
  await page.locator('#fx-reflections').uncheck()
  assert.equal(await page.locator('#fx-reflections').isChecked(),false)
  assert.equal(await page.locator('#fx-contactShadows').isChecked(),true,
    'Independent Custom effects must not reset each other')
  await page.selectOption('#graphics-detail','performance')
  assert.equal(await page.locator('#visual-quality').inputValue(),'custom')
  assert.equal(await page.locator('#fx-lighting').isChecked(),true,
    'Custom detail tier must not discard effect overrides')
  await page.selectOption('#visual-quality','performance')
  assert.equal(await page.locator('#fx-reflections').isChecked(),false)
  assert.equal(await page.locator('#fx-lighting').isChecked(),false)
  assert.equal(await page.locator('#graphics-effects-count').textContent(),'0/7 on')
  await page.locator('#graphics-effects summary').click()
  console.log('Graphics preset and custom-effect switching: PASS')
  await page.selectOption('#speed','8')
  await page.waitForFunction(()=>
    document.getElementById('slam-method')?.textContent?.includes('PCL WASM · ICP'),
    null,{timeout:60000})
  await page.waitForFunction(()=>
    Number.parseInt(document.getElementById('frame')?.textContent?.match(/SAMPLE (\d+)/)?.[1]??'0')>12,
    null,{timeout:60000})
  // Force the actual ICP path, not just a successful wasm download.
  await page.waitForFunction(()=>
    (document.getElementById('icp-matches')?.textContent??'').includes('accepted ICP registrations'),
    null,{timeout:60000})
  // Also traverse the entire replay: late-frame buffer overflows should never
  // be missed because the first 12 frames happened to work.
  await page.waitForFunction(()=>
    /^(COMPLETE|FAILED)/.test(document.getElementById('status')?.textContent??''),
    null,{timeout:90000})
  const status={
    frame:await page.locator('#frame').textContent(),
    slam:await page.locator('#slam-method').textContent(),
    icp:await page.locator('#icp-matches').textContent(),
    status:await page.locator('#status').textContent(),
  }
  console.log(JSON.stringify({status,errors,geometryWarnings,pclWarnings},null,2))
  assert.match(status.status??'',/^COMPLETE · GOAL REACHED$/,
    'Modelica detour replay must reach its recorded goal')
  assert.deepEqual(errors,[], 'Browser crashed during replay')
  assert.deepEqual(geometryWarnings,[], 'Growing geometry buffers')
  assert.deepEqual(pclWarnings,[], 'PCL must not fall back in production')

  // Inject a native PCL fault only *after* successful real ICP acceptance.
  // Verify the optional SLAM overlay can fail without stopping replay.
  assert.equal(await page.evaluate(()=>{
    const core=window.__PCLCore__
    if(!core)return false
    core.PointCloudPointXYZ=undefined
    return true
  }),true,'PCL WASM core not available for failure-injection test')
  await page.locator('#replay').click()
  await page.waitForFunction(()=>
    document.getElementById('slam-method')?.textContent?.includes('PCL runtime failure'),
    null,{timeout:60000})
  await page.waitForFunction(()=>
    Number.parseInt(document.getElementById('frame')?.textContent?.match(/SAMPLE (\d+)/)?.[1]??'0')>20,
    null,{timeout:60000})
  assert.equal(errors.length,0,'Injected PCL failure terminated replay')
  assert.equal(pclWarnings.length,1,'Expected exactly one logged ICP fallback')
  console.log(JSON.stringify({injectedPclFailure:'recovered',
    frame:await page.locator('#frame').textContent(),
    slam:await page.locator('#slam-method').textContent()},null,2))
}finally{
  await browser?.close()
  await new Promise((resolve,reject)=>server.httpServer.close(err=>err?reject(err):resolve()))
}
