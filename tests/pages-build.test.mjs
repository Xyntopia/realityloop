import { strict as assert } from 'node:assert'
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'

const site = new URL('../dist-web/', import.meta.url)
const prefix = process.env.REALITYLOOP_PAGES_BASE ?? '/realityloop/'
const pages = ['index.html', 'drive-lab.html', 'examples/supermarket.html']

for (const page of pages) {
  test(`GitHub Pages build serves ${page} under ${prefix}`, async () => {
    const html = await readFile(new URL(page, site), 'utf8')
    const links = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(([, value]) => value)
    assert.deepEqual(links.filter(link => link.startsWith('/') && !link.startsWith(prefix)), [], 'Links must honor the base path')
    const urls = links.filter(link => link.startsWith(prefix))
    assert.ok(urls.length > 0, 'Expected Vite-generated assets')
    for (const url of urls) {
      const file = path.join(site.pathname, url.slice(prefix.length))
      assert.ok((await stat(file)).isFile(), `Missing published asset: ${url}`)
    }
  })
}

test('every page ships the original RealityLoop icon and shared Taskyon palette', async () => {
  const icon = await readFile(new URL('realityloop-icon.svg', site), 'utf8')
  assert.match(icon, /viewBox="0 0 128 128"/)
  assert.match(icon, /#2a3548/)
  assert.match(icon, /#f78f3b/)
  for (const page of pages) {
    const html = await readFile(new URL(page, site), 'utf8')
    assert.ok(html.includes(`href="${prefix}realityloop-icon.svg"`), `Missing favicon: ${page}`)
    assert.ok(html.includes(`src="${prefix}realityloop-icon.svg"`), `Missing brand icon: ${page}`)
  }
  const styles = (await Promise.all(
    (await readdir(new URL('assets/', site)))
      .filter(file => file.endsWith('.css'))
      .map(file => readFile(new URL(`assets/${file}`, site), 'utf8')),
  )).join('\n')
  for (const color of ['#2a3548', '#f78f3b', '#7fa042']) {
    assert.ok(styles.includes(color), `Missing canonical Taskyon brand color ${color}`)
  }
})

test('gallery previews are bundled in the Pages artifact', async () => {
  const assets = await readdir(new URL('assets/', site))
  assert.ok(assets.some(name => /^realityloop-pbr-supermarket-preview-.*\.jpg$/.test(name)), 'Supermarket preview missing')
  assert.ok(assets.some(name => /^modelica-drive-lab-preview-.*\.png$/.test(name)), 'Traction lab preview missing')
})
