import { realityLoopExamples } from '../src/examples.ts'
import supermarketPreview from '../docs/realityloop-gallery-supermarket.jpg?url'
import tractionPreview from '../docs/realityloop-gallery-traction.jpg?url'
import satellitePreview from '../docs/realityloop-gallery-satellite.jpg?url'
import marsPreview from '../docs/realityloop-gallery-mars.jpg?url'
import constructionPreview from '../docs/realityloop-gallery-construction.jpg?url'
import solarPreview from '../docs/realityloop-gallery-solar.jpg?url'
import './theme.css'
import './catalog.css'

const previews: Readonly<Record<string, string>> = {
  '/docs/realityloop-gallery-supermarket.jpg': supermarketPreview,
  '/docs/realityloop-gallery-traction.jpg': tractionPreview,
  '/docs/realityloop-gallery-satellite.jpg': satellitePreview,
  '/docs/realityloop-gallery-mars.jpg': marsPreview,
  '/docs/realityloop-gallery-construction.jpg': constructionPreview,
  '/docs/realityloop-gallery-solar.jpg': solarPreview,
}

const grids: Record<'featured'|'other',HTMLElement|null> = {
  featured:document.querySelector<HTMLElement>('#examples-grid'),
  other:document.querySelector<HTMLElement>('#other-experiments-grid'),
}
if (!grids.featured||!grids.other) throw Error('Missing example catalog section')

for (const example of realityLoopExamples) {
  const card = document.createElement('article')
  card.className = 'example-card'
  card.id = example.anchor
  const media = document.createElement('a')
  media.href = new URL(example.viewerPath.slice(1), document.baseURI).href
  media.className = 'preview'
  media.setAttribute('aria-label', 'Open ' + example.title)
  const image = document.createElement('img')
  image.src = previews[example.previewImage] ?? example.previewImage
  image.alt = ''
  image.loading = 'lazy'
  media.append(image)
  const body = document.createElement('div')
  body.className = 'example-body'
  const category = document.createElement('span')
  category.className = 'category'
  category.textContent = example.category === 'physics-lab' ? 'PHYSICS EXPERIMENT'
    : example.id==='renewable-plant' ? 'ENERGY SYSTEM SIMULATION'
    : 'ROBOTICS SIMULATION'
  const title = document.createElement('h2')
  title.textContent = example.title
  const description = document.createElement('p')
  description.textContent = example.description
  const tags = document.createElement('div')
  tags.className = 'tags'
  for (const tag of example.tags) {
    const label = document.createElement('span')
    label.textContent = tag
    tags.append(label)
  }
  const link = document.createElement('a')
  link.className = 'open-example'
  link.href = media.href
  link.textContent = 'Open example'
  const permalink = document.createElement('a')
  permalink.className = 'card-permalink'
  permalink.href = '#' + example.anchor
  permalink.textContent = 'Link to this card'
  permalink.setAttribute('aria-label', 'Share homepage link to ' + example.title)
  const actions = document.createElement('div')
  actions.className = 'card-actions'
  actions.append(link, permalink)
  body.append(category, title, description, tags, actions)
  card.append(media, body)
  grids[example.group]!.append(card)
}

// Browser hash navigation runs before the JavaScript-rendered cards exist.
// Correct the initial position once the catalog is mounted, and support
// later hash changes (including back/forward) without reloading the page.
const stickyHeader = document.querySelector<HTMLElement>('.site-header')
if(stickyHeader){
  const updateScrollOffset = () => {
    document.documentElement.style.setProperty(
      '--rl-header-scroll-offset',
      Math.ceil(stickyHeader.getBoundingClientRect().height + 16)+'px',
    )
  }
  updateScrollOffset()
  new ResizeObserver(updateScrollOffset).observe(stickyHeader)
}

const scrollToHashTarget = () => {
  // Anchors are intentionally stable ASCII slugs; no decoding of untrusted
  // fragments is necessary (or able to throw on malformed percent sequences).
  const targetId = window.location.hash.slice(1)
  if (!targetId) return
  document.getElementById(targetId)?.scrollIntoView({block:'start',behavior:'auto'})
}
window.addEventListener('hashchange',scrollToHashTarget)
requestAnimationFrame(scrollToHashTarget)
