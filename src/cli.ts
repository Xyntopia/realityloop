#!/usr/bin/env node
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { parseScenario } from './scenario.ts'
import { runScenario } from './sim.ts'
import { parseCleaningScenario, runCleaningScenario } from './cleaning.ts'
import { parseTennantScenario, runTennantScenario } from './tennant.ts'

const main = async () => {
  const [scenarioFile, outputDir = 'runs/latest'] = process.argv.slice(2)
  if (!scenarioFile) throw new Error('Usage: npm run sim -- <scenario.json> [output-directory]')
  const raw: unknown = JSON.parse(await readFile(resolve(scenarioFile), 'utf8'))
  const object = typeof raw === 'object' && raw !== null ? raw : {}
  const result = 'kind' in object && object.kind === 'modelica'
    ? await (async () => {
        const { parseModelicaScenario } = await import('./modelica/runtime.ts')
        const { runModelicaScenario } = await import('./modelica/node.ts')
        const scenario = parseModelicaScenario(raw)
        const model = await runModelicaScenario(scenario)
        if (scenario.model === 'RealityLoopContacts.SupermarketRobot' ||
            scenario.model === 'RealityLoopContacts.SupermarketBlocked') {
          const { toSupermarketReplay } = await import('./modelica/supermarket.ts')
          return toSupermarketReplay(model)
        }
        return model
      })()
    : 'vehicle' in object
      ? await runTennantScenario(parseTennantScenario(raw))
      : 'route' in object
        ? await runCleaningScenario(parseCleaningScenario(raw))
        : await runScenario(parseScenario(raw))
  const destination = resolve(outputDir)
  await mkdir(destination, { recursive: true })
  await writeFile(join(destination, 'result.json'), JSON.stringify(result, null, 2) + '\n')
  process.stdout.write(JSON.stringify({
    scenario: result.scenario.name,
    status: result.result.passed ? 'passed' : 'failed',
    output: join(destination, 'result.json'),
    engine: result.engine.name,
  }) + '\n')
  if (!result.result.passed) process.exitCode = 1
}
main().catch((error: unknown) => {
  process.stderr.write(String(error) + '\n')
  process.exitCode = 2
})
