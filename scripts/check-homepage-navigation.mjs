#!/usr/bin/env node
/** Verify production-base anchored navigation and dynamically created gallery
 * cards in Chromium, including direct-share links and mobile layouts. */
import {preview} from 'vite'
import {chromium} from 'playwright'
import {strict as assert} from 'node:assert'

const server=await preview({
  root:process.cwd(),base:'/',build:{outDir:'dist-web'},
  preview:{host:'127.0.0.1',port:0},
})
let browser
try {
  browser=await chromium.launch({headless:true,args:[
    ...(process.env.REALITYLOOP_CAPTURE_NO_SANDBOX==='1'?['--no-sandbox']:[]),
  ]})
  const origin=server.resolvedUrls?.local[0]
  assert(origin)
  const fragments=['supermarket','wheel-slip','construction','solar','mars','satellite']
  for(const width of [375,768,1280]) {
    const height=850
    const page=await browser.newPage({viewport:{width,height}})
    const errors=[]
    page.on('pageerror',error=>errors.push(error.message))
    const url=new URL('/#supermarket',origin)
    await page.goto(url.href,{waitUntil:'networkidle',timeout:60000})
    const cards=page.locator('.example-card')
    assert.equal(await cards.count(),6)
    const uniqueIds=await cards.evaluateAll(elements=>elements.map(card=>card.id))
    assert.deepEqual(uniqueIds,fragments)
    const links=await page.locator('.card-permalink').evaluateAll(elements=>
      elements.map(anchor=>anchor.getAttribute('href')))
    assert.deepEqual(links,fragments.map(id=>'#'+id))
    const sources=await cards.evaluateAll(elements=>elements.map(card=>{
      const heading=card.querySelector('.model-details h3')?.textContent
      const notes=card.querySelector('.model-fidelity')?.textContent
      const anchors=[...card.querySelectorAll('.model-source-links a')]
      return {heading,notes,links:anchors.map(a=>({
        url:a.href,blank:a.target==='_blank',
        safe:a.rel.includes('noopener')&&a.rel.includes('noreferrer'),
      })) }
    }))
    assert.deepEqual(sources.map(source=>source.heading),[
      'Modelica model source','Modelica model source',
      'TypeScript model source','TypeScript model source',
      'TypeScript model source','Modelica model source',
    ])
    for(const [i,source] of sources.entries()){
      assert(source.notes?.length>35,'Missing fidelity caveat on '+fragments[i])
      assert(source.links.length>=2,'Missing model or input source on '+fragments[i])
      assert(source.links.every(link=>
        link.url.startsWith('https://github.com/Xyntopia/realityloop/blob/main/') &&
        link.blank && link.safe),'Invalid or unsafe source link on '+fragments[i])
    }
    assert.equal(await page.locator('.scenario-source-link').count(),6)
    const targetPosition=async(id)=>{
      return page.locator('#'+id).evaluate(element=>({
        top:element.getBoundingClientRect().top,
        headerHeight:document.querySelector('.site-header')?.getBoundingClientRect().height??0,
        viewportWidth:innerWidth,
        scrollWidth:document.documentElement.scrollWidth,
      }))
    }
    let position=await targetPosition('supermarket')
    assert(position.top>=position.headerHeight-5,
      'Deep-linked card hidden by sticky header: '+JSON.stringify(position))
    assert(position.top<height*.65,
      'Deep-linked card not scrolled into view: '+JSON.stringify(position))
    assert(position.scrollWidth<=width+1,
      'Horizontal overflow: '+JSON.stringify(position))
    const supermarket=page.locator('#supermarket')
    assert.equal(await supermarket.evaluate(e=>e.matches(':target')),true)
    await page.locator('a[href="#intro"]').first().click()
    await page.waitForFunction(()=>location.hash==='#intro')
    const introPosition=await targetPosition('intro')
    assert(introPosition.top>=introPosition.headerHeight-5,
      'Intro hidden by header: '+JSON.stringify(introPosition))
    assert(introPosition.top<height*.7)
    await page.locator('a[href="#how-it-works"]').first().click()
    await page.waitForFunction(()=>location.hash==='#how-it-works')
    const notePosition=await targetPosition('how-it-works')
    assert(notePosition.top>=notePosition.headerHeight-5,
      'Ownership section hidden by header: '+JSON.stringify(notePosition))
    assert(notePosition.top<height*.7)
    await page.locator('a[href="#mars"].card-permalink').click()
    await page.waitForFunction(()=>location.hash==='#mars')
    const marsPosition=await targetPosition('mars')
    assert(marsPosition.top>=marsPosition.headerHeight-5,
      'Mars card hidden by header: '+JSON.stringify(marsPosition))
    assert(marsPosition.top<height*.7)
    await page.goBack({waitUntil:'domcontentloaded'})
    assert.equal(new URL(page.url()).hash,'#how-it-works')
    assert.equal(await page.locator('#mars').evaluate(e=>e.matches(':target')),false)
    const docs=await page.locator('.documentation-links a').evaluateAll(anchors=>
      anchors.map(a=>({href:a.href,text:a.textContent?.trim()})))
    assert.equal(docs.length,4)
    assert(docs.every(d=>d.href.startsWith('https://taskyon.space/docs/taskyon/')))
    const external=page.locator('#rumoca-examples')
    assert.equal(await external.locator('.rumoca-app').count(),4)
    assert.match(await external.locator('.rumoca-boundary').innerText(),
      /not run through RealityLoop's Taskyon Design Graph/)
    const externalLinks=await external.locator('a').evaluateAll(elements=>
      elements.map(a=>({href:a.href,blank:a.target==='_blank',
        safe:a.rel.includes('noopener')&&a.rel.includes('noreferrer')})))
    assert.equal(await external.locator('.rumoca-tutorial-groups li a').count(),13)
    assert(externalLinks.every(link=>
      /^https:\/\/(?:rumoca\.cognipilot\.org|cognipilot\.github\.io|github\.com\/CogniPilot)\//.test(link.href)
      &&link.blank&&link.safe),'External examples must link to upstream sites safely')
    const tutorials=external.locator('details.rumoca-tutorials')
    assert.equal(await tutorials.evaluate(e=>e.open),false)
    await tutorials.locator('summary').click()
    assert.equal(await tutorials.evaluate(e=>e.open),true)
    assert.equal(await tutorials.locator('li a').first().isVisible(),true)
    await page.goto(new URL('/#rumoca-examples',origin).href,
      {waitUntil:'domcontentloaded'})
    await page.waitForFunction(()=>location.hash==='#rumoca-examples')
    const rumocaPosition=await targetPosition('rumoca-examples')
    assert(rumocaPosition.top>=rumocaPosition.headerHeight-6,
      'External Rumoca section is hidden by sticky header: '+JSON.stringify(rumocaPosition))
    assert(rumocaPosition.top<height*.70,
      'External Rumoca section should be deep-linkable: '+JSON.stringify(rumocaPosition))
    assert(rumocaPosition.scrollWidth<=width+1,'Rumoca section overflows viewport')
    const partnerLinks=await page.locator('.site-links .partner-link').count()
    assert.equal(partnerLinks,3)
    assert.equal(await page.locator('.site-links .partner-logo').count(),3)
    assert.equal(await page.locator('.site-links a[href="https://xyntopia.com/"]').count(),1)
    assert.equal(await page.locator('footer a[href="https://xyntopia.com/"]').count(),1)
    assert.deepEqual(errors,[])
    console.log(JSON.stringify({width,status:'PASS',cards:cards?6:0,
      directLink:'#supermarket',navigation:'#intro -> #how-it-works -> #mars -> back',
      docs:docs.length,rumocaLinks:externalLinks.length,errors}))
    await page.close()
  }
}finally{
  await browser?.close()
  await new Promise((resolve,reject)=>
    server.httpServer.close(error=>error?reject(error):resolve()))
}
