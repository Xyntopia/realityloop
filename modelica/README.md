# RealityLoop Modelica physics

The pinned Rumoca WASM runtime directly compiles and executes `RealityLoopContacts.mo` containing:

- `LongitudinalStickSlip`: reusable 1D hybrid static/kinetic Coulomb contact; `mode = 0` stick, `+1` forward slide, `-1` reverse slide. Breakaway occurs above `μ_static N`; the sliding branch uses `μ_kinetic N`; return to stick occurs when relative velocity crosses a small threshold.
- `WheelBench`: derived contact-force/torque test with a motor pulse and measured re-stick behavior.
- `TennantStickSlip`: open-loop front-steered drive plant with nominal mass/inertia, not a manufacturer-calibrated model.
- `SupermarketRobot`: **default browser simulator**, with front-wheel drive, waypoint steering, chassis planar dynamics and a single round-body versus rectangular-obstacle penalty contact.
- `SupermarketBlocked`: the same compiled model, structurally configured to target a blocked direct route.

For the wheel bench, the no-slip traction reaction satisfying `d(rω-v)/dt = 0` is:

`F_required = (r τ / J - F_ext/m) / (r²/J + 1/m)`

The supermarket model extends this force balance to include yaw and front-wheel steering. The blocker uses a force opposing penetration and approach velocity. No Rapier dynamics are called in those models. The fixed target/waypoint controller and one-obstacle contact approximation are deliberately narrow; they are not full multibody physics.

```sh
npm run sim -- scenarios/modelica-supermarket-detour.json runs/detour
npm run sim -- scenarios/modelica-supermarket-blocked.json runs/blocked # expected exit 1
npm test
```

The scenario adapter in `src/modelica/supermarket.ts` transforms the compiler-produced states into replay observations and mission success criteria; it **does not integrate physics**. Previous smooth `TennantFrontSteerSlip.mo` and `DifferentialDriveSlip.mo` models remain explicit comparators.

**Limitations:** only the central aisle blocker has collision forces, using a circular body proxy; shelf products have no physics collision, obstacles are fixed, the floor is flat, lateral tire slip and combined friction are missing, and parameters are estimates. Discrete friction models require solver event handling and repeated-evaluation tests. Real T7AMR and BrainOS fidelity has not been validated. Future replaceable collision backends should use standard Modelica `external "C"`, not a second JavaScript physics loop.
