import modelicaSource from '../modelica/RealityLoopContacts.mo?raw'
import rumocaWasmUrl from '../node_modules/@taskyon/rumoca/rumoca_bind_wasm_bg.wasm?url'
import {supermarketModelicaScenario,toSupermarketReplay,type SupermarketRoute} from '../src/modelica/supermarket.ts'
import {withModelicaScene} from '../src/modelica/scene.ts'
import {runBrowserDag,hashBrowserBinary} from '../src/dag-browser.ts'
import {canonicalHash} from '../src/vendor/taskyon-comp-dag.mjs'
import {parseModelicaScenario} from '../src/modelica/runtime.ts'

type Runner=Awaited<ReturnType<typeof import('../src/modelica/runtime.ts').createModelicaRunner>>
type LoadedRunner={runner:Runner;compilerHash:string}
let runnerPromise:Promise<LoadedRunner>|undefined
const getRunner=():Promise<LoadedRunner>=>{
  runnerPromise??=(async()=>{
    const {createModelicaRunner}=await import('../src/modelica/runtime.ts')
    const response=await fetch(rumocaWasmUrl)
    if(!response.ok)throw Error('Rumoca WASM fetch failed: '+response.status)
    const bytes=await response.arrayBuffer()
    const compilerHash=await hashBrowserBinary(bytes)
    return {runner:await createModelicaRunner(bytes),compilerHash}
  })().catch(error=>{runnerPromise=undefined;throw error})
  return runnerPromise
}

/** Modelica physics executed as a canonical Taskyon DAG node, browser-local.
 * Taskyon UI and P2P are not used by the simulation or its dependencies. */
export const runModelicaSupermarket=async(route:SupermarketRoute)=>{
  const scenario=supermarketModelicaScenario(route)
  const source=withModelicaScene(modelicaSource)
  const {runner,compilerHash}=await getRunner()
  const executed=await runBrowserDag(
    scenario,
    {modelHash:canonicalHash(source),compilerHash,
      provider:'rumoca',runnerVersion:1},
    input=>toSupermarketReplay(runner.simulate(source,parseModelicaScenario(input))),
  )
  return executed.result
}
