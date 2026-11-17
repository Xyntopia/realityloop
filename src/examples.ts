/** Portable example catalog. Entries describe demos, not a separate graph engine. */
export type RealityLoopExample = Readonly<{
  id: string
  title: string
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
    title: 'Autonomous floor cleaning',
    category: 'simulation',
    description: 'A Tennant-inspired cleaning robot navigates a supermarket with Modelica contacts, LiDAR, localization and clearance checks.',
    viewerPath: '/examples/supermarket.html',
    previewImage: '/docs/realityloop-gallery-supermarket.jpg',
    headlessScenarios: [
      'scenarios/modelica-supermarket-detour.json',
      'scenarios/modelica-supermarket-blocked.json',
    ],
    physics: 'Rumoca / Modelica; optional legacy Rapier comparison',
    tags: ['mobile robotics', 'LiDAR', 'PCL ICP', 'collision'],
  },
  {
    id: 'satellite-adcs',
    title: 'Reconfigurable satellite ADCS',
    category: 'simulation',
    description: 'Assemble 40 cm spacecraft modules, vary inertia and simulate a three-axis reaction-wheel pointing maneuver.',
    viewerPath: '/examples/mission.html?scene=satellite',
    previewImage: '/docs/realityloop-gallery-satellite.jpg',
    headlessScenarios: [
      'scenarios/modular-satellite-compact.json',
      'scenarios/modular-satellite-asymmetric.json',
    ],
    physics: 'Reduced-order Euler rigid body, inertia tensor and reaction wheels',
    tags: ['modular spacecraft','attitude control','inertia tensor','reaction wheels'],
  },
  {
    id: 'iboss-docking',
    title: 'iBOSS modular docking',
    category: 'simulation',
    description: 'A servicer aligns a modular space block with an intelligent interface using a bounded-thrust soft-capture model.',
    viewerPath: '/examples/mission.html?scene=docking',
    previewImage: '/docs/realityloop-gallery-docking.jpg',
    headlessScenarios: ['scenarios/iboss-module-docking.json'],
    physics: 'Reduced-order relative translation and interface capture',
    tags: ['iBOSS','modular robotics','docking','servicing'],
  },
  {
    id: 'mars-rover',
    title: 'Mars habitat construction & rover',
    category: 'simulation',
    description: 'A modular Mars habitat, articulated assembly arms, a legged utility robot and a six-wheel rover in a dusty desert deployment scene. The rover traverse is simulated; habitat assembly is visualization-only.',
    viewerPath: '/examples/mission.html?scene=mars',
    previewImage: '/docs/realityloop-gallery-mars.jpg',
    headlessScenarios: ['scenarios/mars-rover-traverse.json'],
    physics: 'Reduced-order terrain grade and traction',
    tags: ['planetary robotics','Mars','traction','route planning'],
  },
  {
    id: 'construction-delivery',
    title: 'Construction-site delivery',
    category: 'simulation',
    description: 'An autonomous site vehicle transports material past equipment, exclusion zones and uneven ground.',
    viewerPath: '/examples/mission.html?scene=construction',
    previewImage: '/docs/realityloop-gallery-construction.jpg',
    headlessScenarios: ['scenarios/construction-delivery.json'],
    physics: 'Reduced-order traction, steering and clearance',
    tags: ['construction robotics','exclusion zones','autonomy','delivery'],
  },
  {
    id: 'traction-laboratory',
    title: 'Wheel traction laboratory',
    category: 'physics-lab',
    description: 'Explore static/kinetic friction, drive torque, wet-floor traction and wheel slip using compiled Modelica equations.',
    viewerPath: '/drive-lab.html',
    previewImage: '/docs/realityloop-gallery-traction.jpg',
    headlessScenarios: [
      'scenarios/modelica-wheel-breakaway.json',
      'scenarios/modelica-tennant-traction.json',
    ],
    physics: 'Rumoca / Modelica',
    tags: ['contact dynamics', 'traction', 'parameter study'],
  },
]

export const getRealityLoopExample = (id: string): RealityLoopExample | undefined =>
  realityLoopExamples.find(example => example.id === id)
