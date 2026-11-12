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
    previewImage: '/docs/realityloop-safe-corridor-preview.png',
    headlessScenarios: [
      'scenarios/modelica-supermarket-detour.json',
      'scenarios/modelica-supermarket-blocked.json',
    ],
    physics: 'Rumoca / Modelica; optional legacy Rapier comparison',
    tags: ['mobile robotics', 'LiDAR', 'PCL ICP', 'collision'],
  },
  {
    id: 'traction-laboratory',
    title: 'Wheel traction laboratory',
    category: 'physics-lab',
    description: 'Explore static/kinetic friction, drive torque, wet-floor traction and wheel slip using compiled Modelica equations.',
    viewerPath: '/drive-lab.html',
    previewImage: '/docs/modelica-drive-lab-preview.png',
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
