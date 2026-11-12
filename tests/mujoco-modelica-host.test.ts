import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { runMuJoCoExternalModelica } from '../src/modelica/mujoco-host.ts'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const directory = process.env.RUMOCA_EXTERNAL_C_WASM_DIR

test('Modelica external C calls MuJoCo WASM inside the Rumoca solver', {
  skip: !directory && 'Build Rumoca host ABI and set RUMOCA_EXTERNAL_C_WASM_DIR',
}, async () => {
  const result = await runMuJoCoExternalModelica(directory!)
  assert.equal(result.backend, '@mujoco/mujoco')
  assert.ok(result.calls > 10, 'solver must invoke the foreign function repeatedly')
  assert.equal(result.observations[0].depth, 0)
  assert.ok(result.maximumPenetrationMetres > 0.03,
    'MuJoCo collision penetration must reach the compiled Modelica variable')
  assert.ok(result.observations.at(-1)!.x < 4.3,
    'MuJoCo penetration must retard the Modelica equation der(x)')
  assert.ok(result.observations.at(-1)!.timeSeconds >= 1.95)
})
test('an external C Modelica simulation without a scoped host fails closed', {
  skip: !directory && 'Build Rumoca host ABI and set RUMOCA_EXTERNAL_C_WASM_DIR',
}, async () => {
  const runtime = await import(pathToFileURL(
    resolve(directory!, 'rumoca_bind_wasm.js'),
  ).href)
  const source = await readFile(
    new URL('../modelica/RealityLoopMuJoCoHost.mo', import.meta.url), 'utf8',
  )
  assert.throws(() => runtime.simulate_model(
    source, 'RealityLoopMuJoCoHost.CollisionProbe', 2, 0.05, 'auto', '{}',
  ), /no external C host registered/)
})
