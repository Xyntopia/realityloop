import source from '../modelica/KeplerFormation.mo?raw'
import wasmUrl from '../node_modules/@taskyon/rumoca/rumoca_bind_wasm_bg.wasm?url'
import {hashBrowserBinary} from '../src/dag-browser.ts'
import {canonicalHash} from '../src/vendor/taskyon-comp-dag.mjs'
import {orbitalModelicaScenario} from '../src/orbital-formation.ts'
import type {OrbitalElements} from '../src/orbital-elements.ts'
import {parseModelicaScenario,type ModelicaResult} from '../src/modelica/runtime.ts'

type Runner=Awaited<ReturnType<typeof import('../src/modelica/runtime.ts').createModelicaRunner>>
let loaded:Promise<{runner:Runner;compilerHash:string}>|undefined
const initialize=()=>{
  loaded??=(async()=>{
    const {createModelicaRunner}=await import('../src/modelica/runtime.ts')
    const response=await fetch(wasmUrl)
    if(!response.ok)throw Error('Orbit Rumoca WASM download failed: '+response.status)
    const bytes=await response.arrayBuffer()
    const compilerHash=await hashBrowserBinary(bytes)
    return {runner:await createModelicaRunner(bytes),compilerHash}
  })().catch(error=>{loaded=undefined;throw error})
  return loaded
}
/** Real Modelica Kepler formation and immutable compiler/source provenance. */
export const createOrbitalMissionRunner=async()=>{
  const {runner,compilerHash}=await initialize()
  return {
    sourceLock:{
      model:'KeplerFormation',sourceHash:canonicalHash(source),
      compilerHash,provider:'rumoca-wasm',revision:1,
    },
    simulate:(seconds:number,interval:number,elements?:OrbitalElements):ModelicaResult=>runner.simulate(
      source,parseModelicaScenario(orbitalModelicaScenario(seconds,interval,elements)),
    ),
  }
}
