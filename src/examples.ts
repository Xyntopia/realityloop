/** Portable example catalog. Entries describe demos, not a separate graph engine. */
export type RealityLoopExample = Readonly<{
  id: string
  /** Stable homepage fragment identifier for shareable gallery cards. */
  anchor: string
  title: string
  group: 'featured' | 'other'
  category: 'simulation' | 'physics-lab'
  description: string
  viewerPath: string
  previewImage: string
  headlessScenarios: readonly string[]
  physics: string
  tags: readonly string[]
}>

export const realityLoopExamples: readonly RealityLoopExample[] = [
  {
    id: 'supermarket-cleaning',
    anchor: 'supermarket',
    title: 'Autonomous floor cleaning',
    group: 'featured',
    category: 'simulation',
    description: 'A cleaning robot navigates a supermarket with Modelica contacts, synthetic LiDAR and localization, and clearance checks.',
    viewerPath: '/examples/supermarket.html',
    previewImage: '/docs/realityloop-gallery-supermarket.jpg',
    headlessScenarios: [
      'scenarios/modelica-supermarket-detour.json',
      'scenarios/modelica-supermarket-blocked.json',
    ],
    physics: 'Rumoca / Modelica; optional legacy Rapier comparison',
    tags: ['mobile robotics','LiDAR','PCL ICP','collision'],
  },
  {
    id: 'traction-laboratory',
    anchor: 'wheel-slip',
    title: 'Wheel slip laboratory',
    group: 'featured',
    category: 'physics-lab',
    description: 'Explore static and kinetic friction, drive torque, wet-floor traction, and wheel slip using compiled Modelica equations.',
    viewerPath: '/drive-lab.html',
    previewImage: '/docs/realityloop-gallery-traction.jpg',
    headlessScenarios: [
      'scenarios/modelica-wheel-breakaway.json',
      'scenarios/modelica-tennant-traction.json',
    ],
    physics: 'Rumoca / Modelica',
    tags: ['contact dynamics','traction','parameter study'],
  },
  {
    id: 'construction-delivery',
    anchor: 'construction',
    title: 'Construction-site delivery',
    group: 'featured',
    category: 'simulation',
    description: 'A mobile site vehicle passes work equipment and exclusion zones in an open construction site. Traction and clearance use a simplified model.',
    viewerPath: '/examples/mission.html?scene=construction',
    previewImage: '/docs/realityloop-gallery-construction.jpg',
    headlessScenarios: ['scenarios/construction-delivery.json'],
    physics: 'Reduced-order traction, steering and clearance',
    tags: ['construction robotics','exclusion zones','autonomy','delivery'],
  },
  {
    id: 'renewable-plant',
    anchor: 'solar',
    title: 'Utility-scale solar & storage plant',
    group: 'featured',
    category: 'simulation',
    description: 'Explore PV tracker motion, clear-sky generation, inverter clipping, and battery dispatch in a utility-scale plant. A reduced-order study inspired by Joulios layout models.',
    viewerPath: '/examples/power-plant.html',
    previewImage: '/docs/realityloop-gallery-solar.jpg',
    headlessScenarios: ['scenarios/solar-plant-clear-sky.json'],
    physics: 'Solar geometry, reduced-order PV generation and BESS dispatch',
    tags: ['photovoltaics','tracking','energy storage','reproducible DAG'],
  },
  {
    id: 'mars-rover',
    anchor: 'mars',
    title: 'Mars habitat construction & rover',
    group: 'other',
    category: 'simulation',
    description: 'A modular Mars habitat, articulated assembly arms and support robots. Rover traverse physics is active; habitat assembly remains illustrative.',
    viewerPath: '/examples/mission.html?scene=mars',
    previewImage: '/docs/realityloop-gallery-mars.jpg',
    headlessScenarios: ['scenarios/mars-rover-traverse.json'],
    physics: 'Reduced-order terrain grade and traction',
    tags: ['planetary robotics','iBOSS concepts','Mars','route planning'],
  },
  {
    id: 'satellite-adcs',
    anchor: 'satellite',
    title: 'Reconfigurable satellite ADCS',
    group: 'other',
    category: 'simulation',
    description: 'Assemble 40 cm spacecraft modules, vary inertia and simulate a three-axis reaction-wheel pointing maneuver.',
    viewerPath: '/examples/mission.html?scene=satellite',
    previewImage: '/docs/realityloop-gallery-satellite.jpg',
    headlessScenarios: [
      'scenarios/modular-satellite-compact.json',
      'scenarios/modular-satellite-asymmetric.json',
    ],
    physics: 'Reduced-order Euler rigid body, inertia tensor and reaction wheels',
    tags: ['modular spacecraft','iBOSS concepts','inertia tensor','reaction wheels'],
  },
]

export const getRealityLoopExample = (id: string): RealityLoopExample | undefined =>
  realityLoopExamples.find(example => example.id === id)
