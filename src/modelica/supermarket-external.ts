import {readFile} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'
import {createExternalCollisionQuery,type ExternalCollisionProvider}
  from '../collision/contract.ts'
import {supermarketObstacles} from '../geometry.ts'
import {decodeTrajectory,parseModelicaScenario,type ModelicaResult}
  from './runtime.ts'
import {withModelicaScene} from './scene.ts'
import {toSupermarketReplay,type SupermarketReplay,type SupermarketRoute}
  from './supermarket.ts'

type HostRuntime={
  default:(args:{module_or_path:Uint8Array})=>Promise<unknown>
  wasm_init:(threads:number)=>unknown
  simulate_model_with_external_real3:(
    source:string,name:string,duration:number,dt:number,solver:string,
    overrides:string,callback:(x:number,z:number,bodyIndex:number)=>number,
  )=>string
  get_version?:()=>string
  get_git_commit?:()=>string|undefined
}

export type ExternalSupermarketResult={
  model:ModelicaResult
  replay:SupermarketReplay
  provider:ExternalCollisionProvider
  compilerHash:string
  modelHash:string
  geometryHash:string
  callbacks:number
  detectedContacts:number
}

/** Run the *full* existing SupermarketRobot dynamics from Modelica, substituting
 * the collision penetration query through a patched synchronous Rumoca host.
 * The Modelica triangle mesh provides normals until a vector host ABI exists.
 * This deliberately is NOT wired to the stock @taskyon/rumoca browser runtime.
 */
export const runExternalSupermarketModelica=async(
  wasmDirectory:string,provider:ExternalCollisionProvider,
  route:SupermarketRoute,seconds=20,dt=.05,
):Promise<ExternalSupermarketResult>=>{
  const scenario=parseModelicaScenario({
    name:'realityloop-supermarket-'+provider+'-external-'+route,
    kind:'modelica',
    model:route==='detour'
      ?'RealityLoopContacts.SupermarketExternalRobot'
      :'RealityLoopContacts.SupermarketExternalBlocked',
    durationSeconds:seconds,
    intervalSeconds:dt,
    frictionCoefficient:.72,
    motorTorqueNewtonMetres:135,
    collisionBackend:provider,
  })
  const directory=resolve(wasmDirectory)
  const scriptUrl=pathToFileURL(join(directory,'rumoca_bind_wasm.js')).href
  const runtime=(await import(scriptUrl)) as HostRuntime
  if(typeof runtime.simulate_model_with_external_real3!=='function')
    throw Error('External collision requires patched Rumoca real3 host ABI')
  const [wasmBytes,library,imported,meshBackend,external,contacts]=await Promise.all([
    readFile(join(directory,'rumoca_bind_wasm_bg.wasm')),
    readFile(new URL('../../modelica/RealityLoopCollision.mo',import.meta.url),'utf8'),
    readFile(new URL('../../modelica/RealityLoopImportedCollision.mo',import.meta.url),'utf8'),
    readFile(new URL('../../modelica/RealityLoopMeshCollision.mo',import.meta.url),'utf8'),
    readFile(new URL('../../modelica/RealityLoopExternalCollision.mo',import.meta.url),'utf8'),
    readFile(new URL('../../modelica/RealityLoopContacts.mo',import.meta.url),'utf8'),
  ])
  await runtime.default({module_or_path:wasmBytes})
  runtime.wasm_init(0)
  const source=[library,imported,meshBackend,external,
    withModelicaScene(contacts)].join('\n')
  const scene=await createExternalCollisionQuery(provider)
  let callbacks=0,detectedContacts=0
  try{
    const raw=runtime.simulate_model_with_external_real3(
      source,scenario.model,seconds,dt,'auto',
      JSON.stringify({muStatic:scenario.frictionCoefficient,
        motorLimit:scenario.motorTorqueNewtonMetres}),
      (x,z,bodyReal)=>{
        callbacks++
        if(!Number.isInteger(bodyReal)||bodyReal<1||
          bodyReal>supermarketObstacles.length||![x,z].every(Number.isFinite))
          throw Error('Modelica requested invalid collision body or position')
        const id=supermarketObstacles[bodyReal-1].id
        const contact=scene.query({x,z,yaw:0})
          .find(entry=>entry.obstacleId===id)
        if(contact&&contact.penetrationMetres>0)detectedContacts++
        return contact?.penetrationMetres??0
      },
    )
    const {channelNames,observations}=decodeTrajectory(raw,scenario)
    if(callbacks<5||observations.length<2)
      throw Error('External Modelica collision solver returned no useful trace')
    const model:ModelicaResult={
      scenario,channelNames,observations,
      engine:{
        name:'rumoca-wasm',version:runtime.get_version?.()??'patched-local',
        commit:runtime.get_git_commit?.()??'unknown',solver:'auto',
      },
      result:{passed:true,points:observations.length,
        finalTimeSeconds:observations.at(-1)!.timeSeconds},
    }
    const hash=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex')
    const {supermarketGeometrySha256}=await import('../geometry.ts')
    return {
      model,replay:toSupermarketReplay(model),
      provider,compilerHash:hash(wasmBytes),modelHash:hash(source),
      geometryHash:supermarketGeometrySha256,callbacks,detectedContacts,
    }
  }finally{scene.close()}
}
