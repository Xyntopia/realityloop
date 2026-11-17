#!/usr/bin/env node
/** Headless benchmark only. Screenshots/results stay outside the Git checkout.
 * Never infer hardware GPU FPS from a software WebGL result. */
import {createServer} from 'vite'
import {chromium} from 'playwright'
import {fileURLToPath} from 'node:url'
import {mkdtemp,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import assert from 'node:assert/strict'

const root=fileURLToPath(new URL('../',import.meta.url))
const out=await mkdtemp(join(tmpdir(),'realityloop-ao-'))
const vite=await createServer({root,logLevel:'error',
  server:{host:'127.0.0.1',port:0,strictPort:false}})
let browser
try{
  await vite.listen()
  const origin=vite.resolvedUrls?.local[0]
  assert(origin)
  browser=await chromium.launch({headless:true,
    args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle',
      '--use-angle=swiftshader'],
  })
  const page=await browser.newPage({viewport:{width:560,height:315}})
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  page.on('console',message=>{
    if(message.type()==='error')errors.push(message.text())
  })
  await page.goto(new URL('benchmarks/ao.html',origin).href,
    {waitUntil:'domcontentloaded',timeout:60000})
  await page.waitForFunction(()=>Boolean(window.__realityloopAOTest),
    null,{timeout:30000})
  const results=[]
  for(const method of ['off','ssao','gtao']){
    const result=await page.evaluate(async name=>
      window.__realityloopAOTest.measure(name),method)
    const file=join(out,method+'.png')
    const capture=await page.locator('canvas').screenshot({path:file,timeout:30000})
    const image=await page.evaluate(async encoded=>{
      const img=new Image()
      img.src='data:image/png;base64,'+encoded
      await img.decode()
      const canvas=document.createElement('canvas')
      canvas.width=img.width;canvas.height=img.height
      const ctx=canvas.getContext('2d',{willReadFrequently:true})
      ctx.drawImage(img,0,0)
      const rgba=ctx.getImageData(0,0,canvas.width,canvas.height).data
      let sum=0,sum2=0,count=0
      for(let y=0;y<canvas.height;y+=2)
        for(let x=0;x<canvas.width;x+=2){
          const i=(y*canvas.width+x)*4
          const l=.2126*rgba[i]+.7152*rgba[i+1]+.0722*rgba[i+2]
          sum+=l;sum2+=l*l;count++
        }
      const mean=sum/count
      return {meanLuminance:+mean.toFixed(1),
        luminanceStddev:+Math.sqrt(sum2/count-mean*mean).toFixed(1)}
    },capture.toString('base64'))
    results.push({...result,...image,output:file})
    console.log(method,JSON.stringify(result))
  }
  assert.deepEqual(errors,[])
  const report={renderer:'SwiftShader, software WebGL',results,errors,
    warning:'Software-only synchronous frame times are not real GPU estimates'}
  await writeFile(join(out,'results.json'),JSON.stringify(report,null,2))
  console.log('Saved generated benchmark frames and report in temporary folder:',out)
}finally{
  await browser?.close()
  await vite.close()
}
