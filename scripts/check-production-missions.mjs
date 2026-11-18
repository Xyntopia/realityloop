#!/usr/bin/env node
/** Validate all added examples against a minified custom-domain-root build,
 * including actual browser DAG evaluations and 3D rendering. */
import {preview} from 'vite'
import {chromium} from 'playwright'
import {strict as assert} from 'node:assert'
const server=await preview({root:process.cwd(),base:'/',
  build:{outDir:'dist-web'},preview:{host:'127.0.0.1',port:0}})
let browser
try{
  browser=await chromium.launch({headless:true,args:[
    ...(process.env.REALITYLOOP_CAPTURE_NO_SANDBOX==='1'?['--no-sandbox']:[]),
    ...(process.env.REALITYLOOP_CAPTURE_SWIFTSHADER==='1'
      ?['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']:[]),
  ]})
  const origin=server.resolvedUrls?.local[0]
  assert(origin)
  const catalog=await browser.newPage({viewport:{width:1260,height:840}})
  const catErrors=[]
  catalog.on('pageerror',e=>catErrors.push(e.message))
  await catalog.goto(new URL('/',origin).href,{waitUntil:'networkidle'})
  assert.equal(await catalog.locator('.example-card').count(),6)
  assert.deepEqual(await catalog.locator('#examples .example-card h2').allTextContents(),
    ['Autonomous floor cleaning','Wheel slip laboratory',
      'Construction-site delivery','Utility-scale solar & storage plant'])
  assert.deepEqual(await catalog.locator('#other-experiments .example-card h2').allTextContents(),
    ['Mars habitat construction & rover','Reconfigurable satellite ADCS'])
  const thumbnails=await catalog.locator('.example-card img').evaluateAll(images=>
    images.map(image=>({loaded:image.complete&&image.naturalWidth>0,
      width:image.naturalWidth,height:image.naturalHeight})))
  assert.equal(thumbnails.filter(x=>x.loaded).length,6,
    'The homepage must load all six original previews')
  assert.deepEqual(catErrors,[])
  await catalog.close()
  for(const kind of ['satellite','mars','construction']){
    const page=await browser.newPage({viewport:{width:1100,height:700}})
    const errors=[]
    const earthResponses=[]
    page.on('pageerror',e=>errors.push(e.message))
    page.on('response',response=>{
      if(response.url().includes('blue-marble-july-2048'))
        earthResponses.push({url:response.url(),status:response.status()})
    })
    const res=await page.goto(new URL('/examples/mission.html?scene='+kind,origin).href,
      {waitUntil:'domcontentloaded',timeout:60000})
    assert.equal(res?.status(),200)
    await page.waitForFunction(()=>
      /^(PASS|FAIL|ERROR)/.test(
        document.getElementById('mission-status')?.textContent??''),null,
      {timeout:90000})
    const status=await page.locator('#mission-status').innerText()
    assert(status.startsWith('PASS'),kind+' model failed: '+status)
    const frameCount=await page.locator('#timeline').getAttribute('max')
    assert(Number(frameCount)>10)
    assert(await page.locator('#mission-artifact').innerText()!=='—')
    assert(await page.locator('#viewport canvas').count()===1)
    if(kind==='satellite'){
      await page.waitForFunction(()=>
        performance.getEntriesByType('resource').some(entry=>
          entry.name.includes('blue-marble-july-2048')&&entry.responseEnd>0),
        null,{timeout:20000})
      assert.equal(earthResponses.length,1,
        'Satellite must fetch its Blue Marble asset only once')
      assert.equal(earthResponses[0].status,200)
      assert(new URL(earthResponses[0].url).pathname.startsWith('/assets/'),
        'Earth imagery must load from the local Pages build, not a remote server')
      assert.equal(await page.locator('#earth-credit').isVisible(),true,
        'NASA Earth Observatory credit must appear in the satellite UI')
      assert.equal(await page.locator('#inspection-panel').isVisible(),true,
        'The servicer scan map should be visible only on the orbital mission')
      assert.match(await page.locator('#mission-engine').innerText(),/rumoca-wasm.*KeplerFormation/,
        'Orbit must be produced by actual Modelica, not rendered with a synthetic animation')
      await page.locator('#timeline').evaluate(slider=>{
        slider.value=String(Math.round(Number(slider.max)*.62))
        slider.dispatchEvent(new Event('input',{bubbles:true}))
      })
      assert.match(await page.locator('#inspection-status').innerText(),/ICP \d+ matches · map \d+ points/,
        'Planar scanner should record actual ICP registrations in the replay')
      assert.match(await page.locator('#orbit-state').innerText(),/Altitude \d+\.\d+ km · servicer \d+\.\d+ m/,
        'Orbital positions and servicer range must be available at the selected time')
      const first=await page.locator('#metric-c').innerText()
      await page.selectOption('#module-layout','asymmetric')
      await page.waitForFunction(previous=>
        document.getElementById('metric-c')?.textContent!==previous
        && document.getElementById('mission-status')?.textContent?.startsWith('PASS'),
        first,{timeout:90000})
      assert.notEqual(await page.locator('#metric-c').innerText(),first,
        'Inertia tensor must change with the modular satellite layout')
      const originalOrbit=await page.locator('#orbit-state').innerText()
      await page.locator('#orbital-controls summary').click()
      await page.locator('#orbit-a-km').fill('650')
      await page.locator('#simulate').click()
      await page.waitForFunction(original=>
        document.getElementById('mission-status')?.textContent?.startsWith('PASS')
        && document.getElementById('orbit-state')?.textContent!==original,
        originalOrbit,{timeout:90000})
      assert.match(await page.locator('#orbit-state').innerText(),/Altitude 64\d\.\d km/,
        'Changing semi-major axis must reach Rumoca, not just the UI label')
      for(const cameraMode of ['chief','servicer','formation']){
        await page.selectOption('#orbital-camera',cameraMode)
        await page.waitForTimeout(90)
        assert.equal(await page.locator('#viewport canvas').count(),1,
          'Switching orbital cameras must preserve a single render canvas')
      }
    }
    if(kind==='mars'){
      assert.equal(await page.locator('#inspection-panel').isVisible(),false,
        'Do not label the Mars rover as a spacecraft inspection sensor')
      await page.selectOption('#rover-candidate','helios-solar')
      await page.waitForFunction(()=>
        document.getElementById('metric-d')?.textContent==='Helios Solar Rover'
        && document.getElementById('mission-status')?.textContent?.startsWith('PASS'),
        null,{timeout:90000})
      assert.equal(await page.locator('#metric-d').innerText(),'Helios Solar Rover')
    }
    assert.deepEqual(errors,[],kind+' browser errors')
    console.log(JSON.stringify({kind,status,frames:Number(frameCount),errors}))
    await page.close()
  }
}finally{
  await browser?.close()
  await new Promise((ok,fail)=>server.httpServer.close(error=>error?fail(error):ok()))
}
