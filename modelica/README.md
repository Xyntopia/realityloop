# RealityLoop Modelica physics

All production supermarket physics is compiled by Rumoca; the simulator never
uses multiple dynamics engines for the same physical state.

## Contact and vehicle models

- `RealityLoopContacts.SupermarketRobot` and `SupermarketBlocked`: default
  model, with a **replaceable** analytic circle/AABB geometry function. The
  Modelica vehicle still owns steering, tire slip, spring/damper contact force,
  mass, yaw dynamics and trajectory integration.
- `RealityLoopContacts.SupermarketMeshRobot` and `SupermarketMeshBlocked`:
  redeclare that geometry function to
  `RealityLoopMeshCollision.importedBoxContact`. This performs true
  sphere-to-**watertight 3D triangle mesh** contact against the GLB-derived
  `RealityLoopImportedCollision.mo`. Solid-angle winding handles inside/outside,
  and normal and penetration are calculated within Modelica. The robot
  remains a planar point/sphere-at-mid-height approximation, **not** a
  high-fidelity scanned robot hull.
- `RealityLoopMeshContacts.MeshContactProbe`,
  `ImportedSolidProbe`, `ImportedContactDynamics` and
  `ImportedBvhParityProbe`: direct Rumoca tests for closest-point queries,
  closed-solid penetration, contact dynamics, and generated BVH parity.
- `RealityLoopProviders.DefaultProbe` and `AlternateProbe`: verify Modelica
  `replaceable function` / `redeclare` selection on pinned Rumoca.
- `LongitudinalStickSlip`, `WheelBench`, `TennantStickSlip`: stand-alone
  static/kinetic Coulomb and wheel/drive examples.

The supermarket's physical geometry is authored in
`assets/meshes/supermarket-layout.json`; `npm run build:collision-assets`
generates an actual GLB, a strict geometry representation for LiDAR,
rendering, Rapier/MuJoCo, and the packed 3D Modelica package. The runtime
uses `src/modelica/scene.ts` to inject the generated fixture geometry.
The checked-in `RealityLoopContacts.mo` retains a standalone default
parameter layout for independent compilation. To import arbitrary OBJ/STL/GLB
meshes, use `npm run compile:collision-mesh --` as documented in the root
README.

## Reproduce

```sh
npm run check:collision-assets
npm run sim -- scenarios/modelica-supermarket-detour.json runs/detour
npm run sim -- scenarios/modelica-supermarket-mesh-detour.json runs/mesh-detour
npm run sim -- scenarios/modelica-supermarket-mesh-blocked.json runs/mesh-blocked
npm run check && npm test
npm run build:web -- --base /
REALITYLOOP_CAPTURE_NO_SANDBOX=1 REALITYLOOP_CAPTURE_SWIFTSHADER=1 npm run check:browser:mesh
```

The default detour reaches the goal near 14.8 s and clears the five fixtures
by approximately 0.18 m according to a conservative oriented rectangular
clearance check. This enforces a 0.10 m minimum clearance and negligible
contact penetration, but **does not constitute real-world safety validation**.
All material constants and the moving robot geometry remain approximate.
