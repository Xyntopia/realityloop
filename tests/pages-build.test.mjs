import { strict as assert } from 'node:assert'
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'

const site = new URL('../dist-web/', import.meta.url)
const prefix = process.env.REALITYLOOP_PAGES_BASE ?? '/'
const pages = ['index.html', 'drive-lab.html', 'examples/supermarket.html',
  'examples/mission.html','examples/power-plant.html']

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

test('homepage navigation links to sections, developer and related projects', async () => {
  const html = await readFile(new URL('index.html', site), 'utf8')
  assert.match(html, /<nav class="site-links" aria-label="Page sections and related projects">/)
  for (const fragment of ['intro','examples','other-experiments','how-it-works'])
    assert.ok(html.includes(`href="#${fragment}"`),`Missing navigation link #${fragment}`)
  for (const fragment of ['intro','examples','other-experiments','how-it-works'])
    assert.ok(html.includes(`id="${fragment}"`),`Missing target #${fragment}`)
  assert.match(html, /href="https:\/\/xyntopia\.com\/"[^>]*>\s*<img class="partner-logo" src="https:\/\/www\.xyntopia\.com\/assets\/xyntopia_dark_bg\.png"[^>]*\/>Xyntopia<\/a>/)
  assert.match(html, /Developed by <a href="https:\/\/xyntopia\.com\/">Xyntopia<\/a>/)
  assert.match(html, /href="https:\/\/taskyon\.space\/"[^>]*>\s*<img class="partner-logo" src="https:\/\/taskyon\.space\/icons\/favicon-128x128\.png"[^>]*\/>Taskyon<\/a>/)
  assert.match(html, /href="https:\/\/rumoca\.cognipilot\.org\/"[^>]*>\s*<img class="partner-logo" src="https:\/\/rumoca\.cognipilot\.org\/images\/rumoca\.svg"[^>]*\/>Rumoca \/ Modelica<\/a>/)
})

test('Taskyon documentation links target project, graph, workflow and Modelica docs',async()=>{
  const html=await readFile(new URL('index.html',site),'utf8')
  const docs=[
    'user/design-workspaces.md',
    'developer/design-graphs.md',
    'user/task-trees.md',
    'developer/modelica.md',
  ]
  assert.match(html,/class="documentation-links"/)
  for(const file of docs)
    assert.ok(html.includes('https://taskyon.space/docs/taskyon/'+file),
      'Missing Taskyon documentation link: '+file)
})

test('each gallery card has a unique stable public homepage fragment',async()=>{
  const source=await readFile(new URL('../src/examples.ts',import.meta.url),'utf8')
  for(const fragment of ['supermarket','wheel-slip','construction','solar','mars','satellite'])
    assert.ok(source.includes(`anchor: '${fragment}'`),`Missing shareable fragment #${fragment}`)
  const script=await readFile(new URL('../viewer/catalog.ts',import.meta.url),'utf8')
  assert.match(script,/card\.id = example\.anchor/)
  assert.match(script,/permalink\.href = '#' \+ example\.anchor/)
  assert.match(script,/requestAnimationFrame\(scrollToHashTarget\)/)
  assert.match(script,/addEventListener\('hashchange',scrollToHashTarget\)/)
})

test('home hero presents ownership and physical fidelity as goals, not proven results', async () => {
  const html = await readFile(new URL('index.html', site), 'utf8')
  assert.match(html, /Build simulations faster/)
  assert.match(html, /Own the toolchain/)
  assert.match(html, /age of AI agents/)
  assert.match(html, /The simulation you build is yours: its source code, physical models, scenarios, tests, data and execution pipeline/)
  assert.match(html, /Test more scenarios/)
  assert.match(html, /locally or in CI/)
  assert.match(html, /Modelica, an established modeling language/)
  assert.match(html, /reproducible runs and auditable results/)
  assert.match(html, /Expert updates, without dependency/)
  assert.match(html, /fidelity must be demonstrated against real-world measurements/)
  assert.match(html, /not yet validated, production-ready digital twins/)
  assert.doesNotMatch(html, /prototyped in an afternoon|AI AGENT BUILD TIME|~3<span>h<\/span>/)
})

test('homepage explains customer ownership and a simulation CI feedback loop without overstating Taskyon integration',async()=>{
  const html=await readFile(new URL('index.html',site),'utf8')
  assert.match(html,/Your simulation\. Your source code\. Your feedback loop\./)
  assert.match(html,/100% customer-owned simulation/)
  assert.match(html,/including its source code, models, scenarios, tests, data and CI\/CD setup/)
  assert.match(html,/underlying building blocks and dependencies retain their own licenses/)
  assert.match(html,/feedback loop for AI agents/)
  assert.match(html,/simulated reality/)
  assert.match(html,/compilation and unit tests/)
  assert.match(html,/Versioned inputs, reproducible artifacts and headless CI runs/)
  assert.match(html,/Taskyon is an optional extension/)
  assert.match(html,/integrated design automation, parameter exploration, performance analysis/)
  assert.match(html,/parallel simulation runs across CI\/CD and clusters/)
  assert.match(html,/Not yet integrated:/)
  assert.match(html,/remote cluster orchestration, centralized monitoring/)
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

test('satellite bundles low-resolution NASA Blue Marble imagery locally',async()=>{
  const assets=await readdir(new URL('assets/',site))
  const file=assets.find(name=>/^blue-marble-july-2048-.*\.jpg$/.test(name))
  assert.ok(file,'NASA Blue Marble texture must be available offline in Pages')
  const img=await readFile(new URL('assets/'+file,site))
  assert.equal(img.subarray(0,2).toString('hex'),'ffd8')
  assert.ok(img.length>80_000&&img.length<500_000,
    'NASA map should be low-res, visually useful, and lightweight')
  const license=await readFile(new URL('../assets/textures/README.md',import.meta.url),'utf8')
  assert.match(license,/NASA Earth Observatory/)
  assert.match(license,/2048 × 1024/)
  assert.match(license,/source/i)
})

test('power plant publishes a genuine viewer capture and controls',async()=>{
  const html=await readFile(new URL('examples/power-plant.html',site),'utf8')
  assert.match(html,/id="tracker-mode"/)
  assert.match(html,/id="storage-enabled"/)
  assert.match(html,/id="view-mode"/)
  assert.match(html,/id="export-limit"/)
  const source=await readFile(new URL('../src/examples.ts',import.meta.url),'utf8')
  assert.match(source,/power-plant\.html/)
  assert.match(source,/solar-plant-clear-sky\.json/)
  const photo=await readFile(new URL('../docs/realityloop-gallery-solar.jpg',import.meta.url))
  assert(photo.length>35_000,'Plant thumbnail must come from a rendered 3D scene')
  assert.equal(photo.subarray(0,2).toString('hex'),'ffd8')
  const assets=await readdir(new URL('assets/',site))
  assert(assets.some(file=>/^realityloop-gallery-solar-.*\.jpg$/.test(file)))
})

test('gallery includes runnable modular-space, Mars and construction examples', async () => {
  const html=await readFile(new URL('examples/mission.html',site),'utf8')
  for(const key of ['satellite','mars','construction'])
    assert.match(html,new RegExp('value="'+key+'"'))
  assert.match(html,/id="module-layout"/)
  assert.match(html,/id="rover-candidate"/)
  assert.match(html,/id="timeline"/)
  const examples=await readFile(new URL('../src/examples.ts',import.meta.url),'utf8')
  for(const key of ['satellite','mars','construction']){
    assert.ok(examples.includes('mission.html?scene='+key))
    const filename='realityloop-gallery-'+key+'.jpg'
    const jpg=await readFile(new URL('../docs/'+filename,import.meta.url))
    assert.ok(jpg.length>18_000,filename+' should be a real 3D viewport capture')
    assert.equal(jpg.subarray(0,2).toString('hex'),'ffd8')
  }
  const assets=await readdir(new URL('assets/',site))
  for(const key of ['satellite','mars','construction'])
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
