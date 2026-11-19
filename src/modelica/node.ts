import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createModelicaRunner, modelicaSourceFile,
  type ModelicaResult, type ModelicaScenario,
} from './runtime.ts'
import { withModelicaScene } from './scene.ts'
export { withModelicaScene } from './scene.ts'
import type { Obstacle } from '../geometry.ts'

export const runModelicaScenario = async (
  scenario: ModelicaScenario,
  projectDirectory: string = process.cwd(),
  obstacles?: readonly Obstacle[],
): Promise<ModelicaResult> => {
  if(scenario.model.startsWith('RealityLoopContacts.SupermarketExternal'))
    throw Error('External contact backends require a patched Rumoca host; use runExternalSupermarketModelica')
  const packageDirectory = dirname(fileURLToPath(import.meta.resolve('@taskyon/rumoca')))
  const isSupermarket=scenario.model.startsWith('RealityLoopContacts.Supermarket')
  const needsCollisionLibrary=isSupermarket||
    scenario.model.startsWith('RealityLoopMeshContacts.')||
    scenario.model.startsWith('RealityLoopProviders.')
  const needsMeshBackend=scenario.model.startsWith('RealityLoopContacts.SupermarketMesh')
  const needsImportedMesh=needsMeshBackend||
    scenario.model.startsWith('RealityLoopMeshContacts.Imported')
  const [wasmBytes, source, collisionLibrary, importedMesh, meshBackend] = await Promise.all([
    readFile(join(packageDirectory, 'rumoca_bind_wasm_bg.wasm')),
    readFile(resolve(projectDirectory, 'modelica', modelicaSourceFile(scenario.model)), 'utf8'),
    needsCollisionLibrary
      ?readFile(resolve(projectDirectory,'modelica','RealityLoopCollision.mo'),'utf8')
      :Promise.resolve(''),
    needsImportedMesh
      ?readFile(resolve(projectDirectory,'modelica','RealityLoopImportedCollision.mo'),'utf8')
      :Promise.resolve(''),
    needsMeshBackend
      ?readFile(resolve(projectDirectory,'modelica','RealityLoopMeshCollision.mo'),'utf8')
      :Promise.resolve(''),
  ])
  const runner = await createModelicaRunner(wasmBytes)
  const sceneSource = needsCollisionLibrary
    ?collisionLibrary+'\n'+importedMesh+'\n'+meshBackend+'\n'+
      (isSupermarket?withModelicaScene(source,obstacles):source)
    :source
  return runner.simulate(sceneSource, scenario)
}
