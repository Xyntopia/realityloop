import { strict as assert } from 'node:assert'
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'

const site = new URL('../dist-web/', import.meta.url)
const prefix = process.env.REALITYLOOP_PAGES_BASE ?? '/realityloop/'
const pages = ['index.html', 'drive-lab.html', 'examples/supermarket.html',
  'examples/mission.html']

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

test('catalog header links to Taskyon and Rumoca', async () => {
  const html = await readFile(new URL('index.html', site), 'utf8')
  assert.match(html, /<nav class="site-links" aria-label="Related projects">/)
  assert.match(html, /href="https:\/\/taskyon\.space\/"[^>]*>Taskyon<\/a>/)
  assert.match(html, /href="https:\/\/github\.com\/CogniPilot\/rumoca"/)
})

test('home hero highlights fast AI-agent prototype without claiming production validation', async () => {
  const html = await readFile(new URL('index.html', site), 'utf8')
  assert.match(html, /class="velocity-proof"/)
  assert.match(html, /~3<span>h<\/span>/)
  assert.match(html, /AI AGENT BUILD TIME/)
  assert.match(html, /AI coding agent created the supermarket robotics demo/)
  assert.match(html, /Taskyon<\/a>'s Design Graph/)
  assert.match(html, /Rumoca<\/a>'s Modelica toolchain/)
  assert.match(html, /not a validated production simulator/)
  assert.match(html, /href="\.\/examples\/supermarket\.html"/)
})

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

test('production pcl.js retains PointXYZ class identity required by WASM', async () => {
  const assets = await readdir(new URL('assets/', site))
  const chunk = assets.find(name => /^supermarket-.*\.js$/.test(name))
  assert.ok(chunk, 'Built supermarket script missing')
  const source = await readFile(new URL(`assets/${chunk}`, site), 'utf8')
  // pcl.js resolves PointCloud types using _PT.name. The minifier must emit
  // a keepNames assignment for PointXYZ, not just a string in a lookup.
  assert.match(source, /\w+\(\w+,"PointXYZ"\)/,
    'Production minifier stripped pcl.js PointXYZ constructor name')
})

test('dynamic AO algorithms are independently selectable and GTAO is code-split', async () => {
  const html = await readFile(new URL('examples/supermarket.html', site), 'utf8')
  assert.match(html, /id="ao-method"/)
  assert.match(html, /value="ssao" selected/)
  assert.match(html, /value="gtao"/)
  const assets = await readdir(new URL('assets/', site))
  assert.ok(assets.some(name=>/^GTAOPass-.*\.js$/.test(name)),
    'GTAO must remain a separate on-demand chunk, not part of the default scene')
})

test('gallery includes runnable modular-space, Mars and construction examples', async () => {
  const html=await readFile(new URL('examples/mission.html',site),'utf8')
  for(const key of ['satellite','docking','mars','construction'])
    assert.match(html,new RegExp('value="'+key+'"'))
  assert.match(html,/id="module-layout"/)
  assert.match(html,/id="rover-candidate"/)
  assert.match(html,/id="timeline"/)
  const examples=await readFile(new URL('../src/examples.ts',import.meta.url),'utf8')
  for(const key of ['satellite','docking','mars','construction']){
    assert.ok(examples.includes('mission.html?scene='+key))
    const filename='realityloop-gallery-'+key+'.jpg'
    const jpg=await readFile(new URL('../docs/'+filename,import.meta.url))
    assert.ok(jpg.length>18_000,filename+' should be a real 3D viewport capture')
    assert.equal(jpg.subarray(0,2).toString('hex'),'ffd8')
  }
  const assets=await readdir(new URL('assets/',site))
  for(const key of ['satellite','docking','mars','construction'])
    assert.ok(assets.some(name=>name.startsWith('realityloop-gallery-'+key+'-')),
      'Bundled gallery image missing: '+key)
})

test('gallery uses recent RealityLoop-generated previews for both examples', async () => {
  const assets = await readdir(new URL('assets/', site))
  const examples = await readFile(new URL('../src/examples.ts', import.meta.url), 'utf8')
  for (const subject of ['supermarket','traction']) {
    const filename = `realityloop-gallery-${subject}.jpg`
    assert.ok(examples.includes(`/docs/${filename}`), `Wrong preview path: ${subject}`)
    assert.ok(assets.some(name => new RegExp(`^realityloop-gallery-${subject}-.*\\.jpg$`).test(name)),
      `Gallery preview not bundled: ${filename}`)
    const jpg = await readFile(new URL(`../docs/${filename}`,import.meta.url))
    assert.ok(jpg.length > 60_000, `Gallery preview suspiciously small: ${filename}`)
    assert.equal(jpg.subarray(0,2).toString('hex'),'ffd8', 'Expected a JPEG capture')
  }
  assert.ok(!assets.some(name => /^(?:modelica-drive-lab-preview|realityloop-pbr-supermarket-preview)-/.test(name)),
    'Outdated preview assets should not be included in deployment')
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
