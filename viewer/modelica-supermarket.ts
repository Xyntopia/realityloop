import modelicaSource from '../modelica/RealityLoopContacts.mo?raw'
import rumocaWasmUrl from '../node_modules/@taskyon/rumoca/rumoca_bind_wasm_bg.wasm?url'
import { supermarketModelicaScenario, toSupermarketReplay, type SupermarketRoute } from '../src/modelica/supermarket.ts'
import { withModelicaScene } from '../src/modelica/scene.ts'

type Runner = Awaited<ReturnType<typeof import('../src/modelica/runtime.ts').createModelicaRunner>>
let runnerPromise: Promise<Runner> | undefined

/** The default supermarket engine uses only compiled Modelica/Rumoca physics. */
const getRunner = (): Promise<Runner> => {
  runnerPromise ??= (async () => {
    const { createModelicaRunner } = await import('../src/modelica/runtime.ts')
    const response = await fetch(rumocaWasmUrl)
    if (!response.ok) throw Error('Rumoca WASM fetch failed: ' + response.status)
    return createModelicaRunner(await response.arrayBuffer())
  })().catch(error => { runnerPromise = undefined; throw error })
  return runnerPromise
}

export const runModelicaSupermarket = async (route: SupermarketRoute) => {
  const runner = await getRunner()
  return toSupermarketReplay(runner.simulate(
    withModelicaScene(modelicaSource), supermarketModelicaScenario(route)))
}
