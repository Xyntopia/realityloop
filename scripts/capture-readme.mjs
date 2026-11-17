#!/usr/bin/env node
/** Capture original RealityLoop renders for the public README.
 * Uses an optional existing Playwright installation; no external imagery. */
import { createRequire } from 'node:module'
import { createServer } from 'vite'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.REALITYLOOP_PLAYWRIGHT || 'playwright')
const root = fileURLToPath(new URL('../', import.meta.url))
const docs = resolve(root, 'docs')
const vite = await createServer({
  root, logLevel: 'error',
  server: { host: '127.0.0.1', port: 0, strictPort: false },
})
let browser
try {
  await vite.listen()
  const origin = vite.resolvedUrls?.local[0]
  if (!origin) throw Error('Vite server URL unavailable')
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.REALITYLOOP_CHROMIUM || undefined,
    args: [
      ...(process.env.REALITYLOOP_CAPTURE_NO_SANDBOX === '1' ? ['--no-sandbox'] : []),
      ...(process.env.REALITYLOOP_CAPTURE_SWIFTSHADER === '1'
        ? ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] : []),
    ],
  })
  const page = await browser.newPage({
    viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1,
  })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(new URL('examples/supermarket.html', origin).href, {
    waitUntil: 'domcontentloaded', timeout: 60000,
  })

  // Wait for canonical Modelica/Taskyon DAG execution: never capture a loading
  // placeholder or a screenshot sourced from external reference photography.
  await page.waitForFunction(() => {
    const text = document.getElementById('status')?.textContent || ''
    return text.startsWith('SIMULATING') || text.startsWith('COMPLETE')
  }, null, { timeout: 180000 })
  await page.selectOption('#speed', '1')
  await page.waitForFunction(() => {
    const time = document.getElementById('time')?.textContent || ''
    return time !== '—' && time !== ''
  }, null, { timeout: 30000 })

  await mkdir(docs, { recursive: true })
  await page.selectOption('#visual-quality', 'balanced')
  await page.waitForTimeout(1400)
  const overview = resolve(docs, 'realityloop-supermarket-ui.png')
  await page.screenshot({ path: overview, animations: 'disabled', timeout: 60000 })

  // Human eye-level view of the *same simulation* from the store aisle.
  await page.locator('#aisle-camera').click()
  await page.locator('#presentation').click()
  await page.waitForTimeout(1400)
  const shopper = resolve(docs, 'realityloop-supermarket-shopper-view.png')
  await page.screenshot({ path: shopper, animations: 'disabled', timeout: 60000 })

  console.log(JSON.stringify({
    screenshots: [overview, shopper],
    simulation: await page.locator('#status').textContent(),
    eyeLevelView: 'Aisle view',
    pageErrors: errors,
  }, null, 2))
} finally {
  await browser?.close()
  await vite.close()
}
