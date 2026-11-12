import type { ModelicaResult, ModelicaScenario } from '../src/modelica/runtime.ts'
import tennantModel from '../modelica/TennantFrontSteerSlip.mo?raw'
import differentialModel from '../modelica/DifferentialDriveSlip.mo?raw'
import stickSlipModel from '../modelica/RealityLoopContacts.mo?raw'
import rumocaWasmUrl from '../node_modules/@taskyon/rumoca/rumoca_bind_wasm_bg.wasm?url'
import './drive-lab.css'

const element = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id)
  if (!node) throw Error('Missing Drive Lab element ' + id)
  return node as T
}
const input = (id: string) => element<HTMLInputElement>(id)
const output = (id: string, value: string): void => { element(id).textContent = value }
const number = (id: string): number => Number(input(id).value)
const format = (value: number, digits = 2): string => Number.isFinite(value) ? value.toFixed(digits) : '—'

type Runner = Awaited<ReturnType<typeof import('../src/modelica/runtime.ts').createModelicaRunner>>
let runnerPromise: Promise<Runner> | undefined
let calculationId = 0
let visibleResults: [ModelicaResult, ModelicaResult] | undefined

const getRunner = (): Promise<Runner> => {
  runnerPromise ??= (async () => {
    const runtime = await import('../src/modelica/runtime.ts')
    const request = await fetch(rumocaWasmUrl)
    if (!request.ok) throw Error('Cannot load Rumoca WASM binary: HTTP ' + request.status)
    const bytes = await request.arrayBuffer()
    return runtime.createModelicaRunner(bytes)
  })().catch(err => { runnerPromise = undefined; throw err })
  return runnerPromise
}

const channelAt = (result: ModelicaResult, sample: number, channel: string): number =>
  result.observations[sample].channels[channel] ?? NaN

type PlotMode = 'speed' | 'slip' | 'path'
const plot = (canvas: HTMLCanvasElement, results: [ModelicaResult, ModelicaResult], mode: PlotMode): void => {
  const rect = canvas.getBoundingClientRect()
  const width = Math.max(340, Math.round(rect.width))
  const height = Math.max(180, Math.round(rect.height))
  const pixelRatio = Math.min(devicePixelRatio || 1, 2)
  canvas.width = Math.round(width * pixelRatio)
  canvas.height = Math.round(height * pixelRatio)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw Error('No Canvas2D context for Drive Lab')
  ctx.scale(pixelRatio, pixelRatio)
  const margins = { left: 44, right: 15, top: 17, bottom: 28 }
  const plotW = width - margins.left - margins.right
  const plotH = height - margins.top - margins.bottom
  const name = results[0].scenario.model
  const value = (result: ModelicaResult, i: number): [number, number] => {
    const s = result.observations[i]
    if (mode === 'path') return [s.channels.x, s.channels.z]
    if (mode === 'slip') return [s.timeSeconds, s.channels[name.startsWith('RealityLoopContacts.') ? 'slipSpeed' : name === 'TennantFrontSteerSlip' ? 'wheelSlip' : 'slipL']]
    return [s.timeSeconds, s.channels.v]
  }
  const points = results.flatMap(result => result.observations.map((_, i) => value(result, i)))
  const xs = points.map(p => p[0]), ys = points.map(p => p[1])
  const xMin = mode === 'path' ? Math.min(0, ...xs) : 0
  const xMax = Math.max(...xs, xMin + 0.001)
  const minY = Math.min(0, ...ys)
  const maxY = Math.max(0.001, ...ys)
  const padding = Math.max((maxY - minY) * 0.08, 0.005)
  const yMin = minY - padding, yMax = maxY + padding
  const fx = (x: number) => margins.left + (x - xMin) / Math.max(xMax - xMin, 1e-12) * plotW
  const fy = (y: number) => margins.top + (yMax - y) / Math.max(yMax - yMin, 1e-12) * plotH
  ctx.lineWidth = 1
  ctx.font = '10px ui-sans-serif,system-ui,sans-serif'
  ctx.fillStyle = '#9fbdc2'
  ctx.strokeStyle = '#2a4550'
  for (let j = 0; j <= 4; j++) {
    const x = margins.left + j / 4 * plotW
    const y = margins.top + j / 4 * plotH
    ctx.beginPath(); ctx.moveTo(x, margins.top); ctx.lineTo(x, margins.top + plotH); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(margins.left, y); ctx.lineTo(margins.left + plotW, y); ctx.stroke()
    ctx.fillText(format(xMin + j / 4 * (xMax - xMin), 1), x - 8, height - 7)
    ctx.fillText(format(yMax - j / 4 * (yMax - yMin), 2), 4, y + 3)
  }
  results.forEach((result, k) => {
    ctx.beginPath()
    ctx.lineWidth = 2.4
    ctx.strokeStyle = k === 0 ? '#36dbc7' : '#f0b861'
    result.observations.forEach((_, i) => {
      const [x, y] = value(result, i)
      if (i === 0) ctx.moveTo(fx(x), fy(y))
      else ctx.lineTo(fx(x), fy(y))
    })
    ctx.stroke()
  })
}

const redraw = () => {
  if (!visibleResults) return
  plot(element<HTMLCanvasElement>('speed-chart'), visibleResults, 'speed')
  plot(element<HTMLCanvasElement>('slip-chart'), visibleResults, 'slip')
  plot(element<HTMLCanvasElement>('path-chart'), visibleResults, 'path')
}

const updateLabels = () => {
  output('torque-value', format(number('torque'), 0) + ' N·m')
  output('dry-value', format(number('dry')))
  output('wet-value', format(number('wet')))
}
const run = async (): Promise<void> => {
  const id = ++calculationId
  const button = element<HTMLButtonElement>('calculate')
  button.disabled = true
  output('status', 'Loading and compiling Modelica physics…')
  try {
    const model = element<HTMLSelectElement>('model').value as ModelicaScenario['model']
    const { parseModelicaScenario } = await import('../src/modelica/runtime.ts')
    const runner = await getRunner()
    if (id !== calculationId) return
    const base = parseModelicaScenario({
      name: 'tire-traction-comparison',
      kind: 'modelica',
      model,
      durationSeconds: 3,
      intervalSeconds: 0.025,
      frictionCoefficient: number('dry'),
      motorTorqueNewtonMetres: number('torque'),
    })
    const source = model.startsWith('RealityLoopContacts.') ? stickSlipModel : model === 'TennantFrontSteerSlip' ? tennantModel : differentialModel
    const high = runner.simulate(source, base)
    const low = runner.simulate(source, { ...base, frictionCoefficient: number('wet') })
    if (id !== calculationId) return
    visibleResults = [high, low]
    const highV = high.observations.at(-1)!.channels.v
    const lowV = low.observations.at(-1)!.channels.v
    output('dry-speed', format(highV, 3) + ' m/s')
    output('wet-speed', format(lowV, 3) + ' m/s')
    output('speed-delta', format(highV - lowV, 3) + ' m/s')
    output('model-name', model.startsWith('RealityLoopContacts.') ? 'Stick / slip' : model === 'TennantFrontSteerSlip' ? 'Smooth tire' : 'Differential')
    output('engine', 'Rumoca ' + high.engine.version + ' · WASM')
    output('status', 'PASS · ' + high.result.points + ' points per trajectory · source compiled')
    redraw()
  } catch (error) {
    output('status', 'FAILED · ' + String(error))
  } finally {
    button.disabled = false
  }
}
element('calculate').addEventListener('click', () => void run())
for (const id of ['torque', 'dry', 'wet']) {
  element(id).addEventListener('input', updateLabels)
}
element('model').addEventListener('change', () => {
  input('torque').value = element<HTMLSelectElement>('model').value === 'DifferentialDriveSlip' || element<HTMLSelectElement>('model').value === 'RealityLoopContacts.WheelBench' ? '10' : '300'
  updateLabels()
  void run()
})
addEventListener('resize', redraw)
updateLabels()
void run()
