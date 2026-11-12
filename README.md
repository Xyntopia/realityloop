# RealityLoop

Standalone, repeatable robot simulation and agent-evaluation prototype, using a Tennant T7AMR-inspired supermarket scrubber. **Not manufacturer CAD, BrainOS software or validated autonomous navigation.**

## Run

```sh
npm ci
npm run dev                 # http://127.0.0.1:5173/
npm run check && npm test
npm run build && npm run build:web
```

The supermarket viewer defaults to a compiled Rumoca/Modelica plant and offers legacy Rapier as an opt-in comparison. Modelica integrates planar chassis motion, steering and longitudinal stick/slip, with all five shelf/aisle rectangles participating in contact. The smooth corridor controller reaches the goal in **14.8 s simulated time** with **~0.18 m projected swept clearance** using the Tennant reference rectangle (1.651 × 0.889 m). Replay acceptance requires a goal arrival, negligible analytic penetration and **at least 0.10 m swept-footprint clearance**. This remains a planar geometry/vehicle approximation, not a real-world safety certification.

The sensor visualization now includes **five multi-elevation 3D LiDAR point clouds**, 2D occupancy mapping with **PCL.js WASM ICP** scan registration, a rendered front RGB camera, synthetic IMU readings and wheel-encoder samples. Rear RGB and front depth streams have timestamped frame/calibration *metadata*, but **no real depth image or rear RGB pixels yet**. The localization system is a 2D scan-registration/odometry front end with occupancy mapping, not a full 3D SLAM/loop-closure engine. Sensor placements are illustrative rather than Tennant-sourced.

![RealityLoop safe corridor with LiDAR, ICP localization and clearance telemetry](docs/realityloop-safe-corridor-preview.png)

### Independent MuJoCo collision-only WASM reference

The official `@mujoco/mujoco@4.0.1` WASM module is available as an **optional collision-only reference**, separate from Rumoca. `src/mujoco-collision.ts` loads shelf/obstacle geometry, calls `mj_kinematics` then `mj_collision` for each input pose and returns penetrating contacts with outward normals. It never calls `mj_step`; it does **not** integrate a second physics state. Tests verify all five obstacles, sign conventions and repeatability.

For the desired standard Modelica boundary:

- `modelica/RealityLoopMuJoCo.mo`: conceptual Modelica `ExternalObject` and `external "C"` API.
- `native/realityloop_mujoco.h`, `native/realityloop_mujoco.c`: C ABI shim implementing persistent MuJoCo scene and geometry-only contact queries.

**Important:** these C bindings are *not linked into the current Rumoca WASM simulator*. In this pinned Rumoca build even a minimal `external "C"` runtime probe fails; native/WASM external-library linking and `ExternalObject` lifecycle support must be implemented and verified before the Modelica package is executable. The C shim itself is not compiled or linked in current CI; refer to `native/README.md`. Do not advertise MuJoCo as the default physics engine.

## Headless scenarios

```sh
npm run sim -- scenarios/modelica-supermarket-detour.json runs/modelica-detour
npm run sim -- scenarios/modelica-supermarket-blocked.json runs/modelica-blocked # expected exit 1
npm run sim -- scenarios/modelica-wheel-breakaway.json runs/contact
npm run sim -- scenarios/tennant-detour.json runs/rapier-detour
```

The JSON run results include a checked minimum swept clearance, nearest obstacle, sample count, simulated arrival time and explicit failure reason. The clearance checker uses conservative separating-axis tests of an oriented rectangular body and densifies solver poses. Browser visualization runs without integration-side collision code. The independent wheel-slip comparison is at `/drive-lab.html`.

## Known limitations and priorities

1. **Next fidelity step:** improve physical contact normals/constraints, turn-swept envelope and calibrated vehicle geometry; the planar clearance result does not replace 3D collision or real-robot tests.
2. **Priority 2:** general-purpose Rumoca external-C ABI + native/WASM symbol resolution, then make MuJoCo/Rapier contact queries replaceable Modelica packages without double integration.
3. **Priority 3:** robust 3D SLAM/pose graph and loop closure, realistic RGB/depth camera outputs, calibrated sensor timing/noise/bias, and IMU-wheel-LiDAR fusion.
4. **Later:** accurate Tennant drivetrain/tire calibration, responsive sensor-based navigation, additional safety checks and BrainOS/ROS adapters.

RealityLoop is an independent local Git submodule at `realityloop/`. **No changes are pushed automatically.** Root requirements and project proposal remain in `../SYSTEM_DEFINITION.csv` and `../proposals/realityloop-simulator-v071.md`.
