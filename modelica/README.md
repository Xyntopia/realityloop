# RealityLoop Modelica physics

`RealityLoopContacts.mo` compiles and runs through the pinned Rumoca WASM runtime:

- `LongitudinalStickSlip`: 1D static/kinetic Coulomb contact, modes 0 (stick), +1/-1 (forward/reverse slip), breakaway and resticking
- `WheelBench`: simple torque-pulse wheel reaction test
- `TennantStickSlip`: front-steered open-loop drive plant
- `SupermarketRobot`: Rumoca-authoritative planar drive, waypoint controller, **five** fixed supermarket rectangular collision fixtures, circular contact footprint and compliant penalty contact force
- `SupermarketBlocked`: same dynamics with direct blocked route
- `SupermarketShelfProbe`: regression fixture deliberately approaching the south shelf

`RealityLoopMuJoCo.mo` defines the **intended**, standard Modelica `external "C"` collision ABI with a persistent MuJoCo scene. **Not executable by the current Rumoca WASM build**, and the native C shim has not been compiled or validated. The official MuJoCo WASM reference works separately through `../src/mujoco-collision.ts`.

```sh
npm run sim -- scenarios/modelica-supermarket-detour.json runs/detour
npm run sim -- scenarios/modelica-supermarket-blocked.json runs/blocked # expected exit 1
npm test
```

The current route intersects the newly physical shelves (compliant penetration ~0.16 m); future collision-avoidance must keep an explicit clearance margin. A positive contact force is **not** proof of a safe trajectory. Current friction and steering parameters are illustrative, not calibrated to Tennant data. Full 3D rigid-body contact, lateral tire friction and multi-body normal loads remain future work.
