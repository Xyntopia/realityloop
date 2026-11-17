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

test('every page ships the RealityLoop flask/caliper icon and Taskyon palette', async () => {
  const icon = await readFile(new URL('realityloop-icon.svg', site), 'utf8')
  assert.match(icon, /viewBox="0 0 128 128"/)
  assert.match(icon, /#2a3548/)
  assert.match(icon, /#f78f3b/)
  assert.match(icon, /flask and caliper in an iteration loop/)
  assert.doesNotMatch(icon, /<rect[^>]*fill="#fff(?:fff)?"/, 'App icon background must be transparent')
  assert.doesNotMatch(icon, /#7fa042|#8bb4ed|design node/)
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
  for (const color of ['#2a3548', '#f78f3b']) {
    assert.ok(styles.includes(color), `Missing canonical Taskyon brand color ${color}`)
  }
  assert.doesNotMatch(styles, /#7fa042|--rl-accent/, 'Accent olive is reserved, not part of normal UI')
})

test('gallery previews are bundled in the Pages artifact', async () => {
  const assets = await readdir(new URL('assets/', site))
  assert.ok(assets.some(name => /^realityloop-pbr-supermarket-preview-.*\.jpg$/.test(name)), 'Supermarket preview missing')
  assert.ok(assets.some(name => /^modelica-drive-lab-preview-.*\.png$/.test(name)), 'Traction lab preview missing')
})

test('README documents real browser-rendered operator and shopper screenshots', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8')
  assert.ok(
    readme.indexOf('docs/realityloop-supermarket-shopper-view.png') < readme.indexOf('## Run'),
    'The customer-eye-level capture must be the leading README image',
  )
  assert.doesNotMatch(readme, /This is the simulated environment.not an external photograph or a calibrated digital twin|not a reference photograph or AI-generated image/i)
  for (const filename of ['realityloop-supermarket-ui.png', 'realityloop-supermarket-shopper-view.png']) {
    assert.ok(readme.includes(`docs/${filename}`), `README missing ${filename}`)
    const png = await readFile(new URL(`../docs/${filename}`, import.meta.url))
    assert.ok(png.length > 100_000, `Screenshot appears empty: ${filename}`)
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
    assert.equal(png.readUInt32BE(16), 1600)
    assert.equal(png.readUInt32BE(20), 900)
  }
})
