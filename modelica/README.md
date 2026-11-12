# RealityLoop Modelica physics

`RealityLoopContacts.mo` compiles and runs through the pinned Rumoca WASM runtime:

- `LongitudinalStickSlip`: 1D static/kinetic Coulomb contact, modes 0 (stick), +1/-1 (forward/reverse slip), breakaway and resticking
- `WheelBench`: simple torque-pulse wheel reaction test
- `TennantStickSlip`: front-steered open-loop drive plant
- `SupermarketRobot`: Rumoca-authoritative planar drive, smooth corridor lookahead controller (legacy waypoints optional), five fixed supermarket box fixtures, circular contact-force proxy and Coulomb traction
- `SupermarketBlocked`: same dynamics with direct blocked route
- `SupermarketShelfProbe`: regression fixture deliberately approaching the south shelf

`RealityLoopMuJoCoHost.mo` is a **tested, opt-in** Modelica `external "C"` probe: a locally patched Rumoca WASM calls the official MuJoCo WASM collision engine through a scoped synchronous 3-Real scalar host ABI, and the returned depth affects `der(x)` in the compiled Modelica DAE. It runs headlessly via `npm run test:mujoco-modelica` after `npm run build:rumoca-host` with the matching Wasm toolchain. Full `RealityLoopMuJoCo.mo` `ExternalObject` plus `native/realityloop_mujoco.{h,c}` C array/normal scene ABI remains **uncompiled and unlinked**; active supermarket still uses analytic Modelica contacts.

```sh
npm run sim -- scenarios/modelica-supermarket-detour.json runs/detour
npm run sim -- scenarios/modelica-supermarket-blocked.json runs/blocked # expected exit 1
npm test
```

The current default detour reaches the goal in ~14.8 s, without analytic contact-force activation, and clears all five obstacles by at least ~0.18 m under a conservative oriented rectangle (reference dimensions 1.651 × 0.889 m), including interpolated samples. A **0.10 m minimum projected clearance** and zero analytic penetration are machine-enforced gates. `src/geometry.ts` supplies the scene, and `src/modelica/scene.ts` generates Modelica parameters from it for Node and browser runs; the `.mo` file retains a directly runnable default layout. Vehicle dynamics, lateral contact, obstacle shapes and contact constraints are still simplified, uncalibrated research fixtures, NOT a real-world safety guarantee.
