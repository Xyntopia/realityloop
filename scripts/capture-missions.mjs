#!/usr/bin/env node
/** Build original thumbnails from the actual running mission visualization.
 * Third-party reference imagery is never imported or committed. */
import {createServer} from 'vite'
import {chromium} from 'playwright'
import {fileURLToPath} from 'node:url'
import {resolve} from 'node:path'
import {strict as assert} from 'node:assert'
const root=fileURLToPath(new URL('../',import.meta.url))
const server=await createServer({root,logLevel:'error',
  server:{host:'127.0.0.1',port:0,strictPort:false}})
let browser
try{
  await server.listen()
  const origin=server.resolvedUrls?.local[0]
  assert(origin)
  browser=await chromium.launch({headless:true,args:[
    ...(process.env.REALITYLOOP_CAPTURE_NO_SANDBOX==='1'?['--no-sandbox']:[]),
    ...(process.env.REALITYLOOP_CAPTURE_SWIFTSHADER==='1'
      ?['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']:[]),
  ]})
  const all=['satellite','docking','mars','construction']
  const requested=process.env.REALITYLOOP_CAPTURE_SCENE
  if(requested&&!all.includes(requested))throw Error('Unknown capture scene: '+requested)
  for(const kind of requested?[requested]:all){
    const page=await browser.newPage({viewport:{width:1440,height:810},
      deviceScaleFactor:1})
    const errors=[]
    page.on('pageerror',error=>errors.push(error.message))
    await page.goto(new URL('examples/mission.html?scene='+kind,origin).href,
      {waitUntil:'domcontentloaded',timeout:60000})
    await page.waitForFunction(()=>
      document.getElementById('mission-status')?.textContent?.startsWith('PASS'),
      null,{timeout:60000})
    await page.evaluate(()=>{
      const slider=document.getElementById('timeline')
      const factor=new URLSearchParams(location.search).get('scene')==='satellite'?.6:.8
      slider.value=String(Math.round(Number(slider.max)*factor))
      slider.dispatchEvent(new Event('input',{bubbles:true}))
    })
    await page.waitForTimeout(400)
    assert.deepEqual(errors,[],kind+' browser errors')
    const destination=resolve(root,'docs/realityloop-gallery-'+kind+'.jpg')
    await page.screenshot({path:destination,type:'jpeg',quality:87,
      animations:'disabled',timeout:60000})
    const status=await page.locator('#mission-status').innerText()
    const metric=await page.locator('#metric-a').innerText()
    console.log(kind,{status,metric,destination})
    await page.close()
  }
}finally{
  await browser?.close()
  await server.close()
}
