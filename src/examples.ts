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
  /** The executable model source, not merely the visual scene renderer. */
  sourceKind: 'Modelica' | 'TypeScript'
  modelSources: readonly Readonly<{label:string;path:string}>[]
  /** Explicit model boundary: no physics fidelity is implied by the preview. */
  fidelityNote: string
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
    sourceKind: 'Modelica',
    modelSources: [
      {label:'Robot and contact equations',path:'modelica/RealityLoopContacts.mo'},
      {label:'Collision geometry',path:'src/geometry.ts'},
    ],
    fidelityNote: 'Planar drive, Coulomb traction and simplified box contacts. Synthetic sensors; not a calibrated Tennant vehicle or safety validation.',
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
    sourceKind: 'Modelica',
    modelSources: [
      {label:'Coulomb stick/slip',path:'modelica/RealityLoopContacts.mo'},
      {label:'Smooth tire alternative',path:'modelica/TennantFrontSteerSlip.mo'},
      {label:'Differential drive',path:'modelica/DifferentialDriveSlip.mo'},
    ],
    fidelityNote: 'Compiled static/kinetic friction and alternative simplified driveline models. Parameters are illustrative, not measured tire or surface data.',
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
    sourceKind: 'TypeScript',
    modelSources: [
      {label:'Terrain and vehicle solver',path:'src/mission-experiments.ts'},
    ],
    fidelityNote: 'Bounded steering and friction-limited travel around static hazard zones. No full vehicle dynamics or site-specific safety validation.',
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
    sourceKind: 'TypeScript',
    modelSources: [
      {label:'PV, inverter and battery solver',path:'src/solar-plant.ts'},
    ],
    fidelityNote: 'Clear-sky irradiance, simplified losses and bounded battery dispatch. No measured weather, detailed electrical network or validated plant yield.',
    tags: ['photovoltaics','tracking','energy storage','reproducible DAG'],
  },
  {
    id: 'mars-rover',
    anchor: 'mars',
    title: 'Mars habitat construction & rover',
    group: 'other',
    category: 'simulation',
    description: 'A modular Mars habitat and six-wheel rover on a dusty, shaded regolith site. Its traction/traverse physics is active; assembly arms and support robots are illustrative.',
    viewerPath: '/examples/mission.html?scene=mars',
    previewImage: '/docs/realityloop-gallery-mars.jpg',
    headlessScenarios: ['scenarios/mars-rover-traverse.json'],
    physics: 'Reduced-order terrain grade and traction',
    sourceKind: 'TypeScript',
    modelSources: [
      {label:'Rover traverse solver',path:'src/mission-experiments.ts'},
    ],
    fidelityNote: 'Synthetic terrain, Martian gravity and simplified traction. Habitat assembly and manipulators are visual only; regolith and suspension are not calibrated.',
    tags: ['planetary robotics','iBOSS concepts','Mars','route planning'],
  },
  {
    id: 'satellite-adcs',
    anchor: 'satellite',
    title: 'Reconfigurable satellite ADCS',
    group: 'other',
    category: 'simulation',
    description: 'A 40 cm modular satellite and a co-orbital servicer follow a Rumoca/Modelica Keplerian formation. A synthetic depth scanner builds a planar ICP map while the target runs reaction-wheel ADCS.',
    viewerPath: '/examples/mission.html?scene=satellite',
    previewImage: '/docs/realityloop-gallery-satellite.jpg',
    headlessScenarios: [
      'scenarios/modular-satellite-compact.json',
      'scenarios/modular-satellite-asymmetric.json',
    ],
    physics: 'Modelica Keplerian two-body orbit + reduced-order Euler ADCS + synthetic planar ICP inspection',
    sourceKind: 'Modelica',
    modelSources: [
      {label:'Chief and servicer Keplerian orbit',path:'modelica/KeplerFormation.mo'},
      {label:'Formation frame and trajectory',path:'src/orbital-formation.ts'},
      {label:'Planar range scan and ICP registration',path:'src/orbital-inspection.ts'},
      {label:'Inertia and attitude solver',path:'src/mission-experiments.ts'},
    ],
    fidelityNote: 'Rumoca/Modelica two-body orbital-element propagation (no J2, drag or thrust), reduced-order reaction-wheel ADCS and synthetic 2D ICP with an initial pose prior. Neither flight-qualified orbital navigation nor six-degree-of-freedom SLAM.',
    tags: ['modular spacecraft','iBOSS concepts','Keplerian orbit','inspection SLAM'],
  },
]

export const getRealityLoopExample = (id: string): RealityLoopExample | undefined =>
  realityLoopExamples.find(example => example.id === id)
