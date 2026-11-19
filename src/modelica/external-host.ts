import {readFile} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {createExternalCollisionQuery,type ExternalCollisionProvider}
  from '../collision/contract.ts'

export type ExternalCollisionSample={
  timeSeconds:number;x:number;z:number;yaw:number;depth:number
}
export type ExternalCollisionReport={
  engine:'rumoca-wasm-external-c-real3'
  backend:ExternalCollisionProvider
  model:'RealityLoopCollisionHost.CollisionProbe'
  calls:number
  maximumPenetrationMetres:number
  observations:ExternalCollisionSample[]
}
type HostRuntime={
  default:(args:{module_or_path:Uint8Array})=>Promise<unknown>
  wasm_init:(threads:number)=>unknown
  simulate_model_with_external_real3:(
    source:string,name:string,duration:number,dt:number,
    solver:string,overrides:string,
    callback:(x:number,z:number,yaw:number)=>number
  )=>string
}
/** Optional backend with a synchronous callback from the Modelica solver.
 * No MuJoCo mj_step() or Rapier World.step(). Fail closed if the checked host
 * ABI is not present; do NOT silently switch to JS dynamics. */
export const runExternalCollisionModelica=async(
  externalWasmDirectory:string,provider:ExternalCollisionProvider,
):Promise<ExternalCollisionReport>=>{
  const directory=resolve(externalWasmDirectory)
  const runtime=(await import(
    pathToFileURL(join(directory,'rumoca_bind_wasm.js')).href
  )) as HostRuntime
  if(typeof runtime.simulate_model_with_external_real3!=='function')
    throw Error('Rumoca WASM runtime has no scoped external C real3 host API')
  await runtime.default({
    module_or_path:await readFile(join(directory,'rumoca_bind_wasm_bg.wasm')),
  })
  runtime.wasm_init(0)
  const source=await readFile(
    fileURLToPath(new URL('../../modelica/RealityLoopCollisionHost.mo',import.meta.url)),
    'utf8')
  const scene=await createExternalCollisionQuery(provider)
  let calls=0
  try{
    const payloadRaw:unknown=JSON.parse(runtime.simulate_model_with_external_real3(
      source,'RealityLoopCollisionHost.CollisionProbe',2,.05,'auto','{}',
      (x,z,yaw)=>{
        calls++
        const contacts=scene.query({x,z,yaw})
        return Math.max(0,...contacts.map(c=>c.penetrationMetres))
      },
    ))
    if(typeof payloadRaw!=='object'||!payloadRaw||!('payload' in payloadRaw))
      throw Error('Rumoca external-host simulation did not return a trajectory')
    const p=payloadRaw.payload as {names:string[];allData:number[][]}
    if(!Array.isArray(p.names)||!Array.isArray(p.allData))
      throw Error('Rumoca external-host returned malformed trajectory')
    const col=(name:string)=>{
      const index=p.names.indexOf(name)
      if(index<0)throw Error('Missing Modelica collision channel '+name)
      return p.allData[index+1]
    }
    const times=p.allData[0],xs=col('x'),zs=col('z')
    const yaws=col('yaw'),depths=col('depth')
    if(!Array.isArray(times)||times.length<5||times.length>1000||
      ![xs,zs,yaws,depths].every(a=>Array.isArray(a)&&a.length===times.length))
      throw Error('Invalid external-host Modelica samples')
    const observations=times.map((timeSeconds,i)=>({
      timeSeconds,x:xs[i],z:zs[i],yaw:yaws[i],depth:depths[i],
    }))
    if(calls<1||observations.some(s=>!Object.values(s).every(Number.isFinite)))
      throw Error('External collision Modelica callback did not execute')
    return {
      engine:'rumoca-wasm-external-c-real3',backend:provider,
      model:'RealityLoopCollisionHost.CollisionProbe',
      calls,maximumPenetrationMetres:Math.max(...depths),observations,
    }
  }finally{scene.close()}
}
