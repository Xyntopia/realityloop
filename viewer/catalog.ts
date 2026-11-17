import { realityLoopExamples } from '../src/examples.ts'
import supermarketPreview from '../docs/realityloop-gallery-supermarket.jpg?url'
import tractionPreview from '../docs/realityloop-gallery-traction.jpg?url'
import './theme.css'
import './catalog.css'

const previews: Readonly<Record<string, string>> = {
  '/docs/realityloop-gallery-supermarket.jpg': supermarketPreview,
  '/docs/realityloop-gallery-traction.jpg': tractionPreview,
}

const grid = document.querySelector<HTMLElement>('#examples')
if (!grid) throw Error('Missing example catalog')

for (const example of realityLoopExamples) {
  const card = document.createElement('article')
  card.className = 'example-card'
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
  category.textContent = example.category === 'simulation' ? 'ROBOTICS SIMULATION' : 'PHYSICS EXPERIMENT'
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
  body.append(category, title, description, tags, link)
  card.append(media, body)
  grid.append(card)
}
