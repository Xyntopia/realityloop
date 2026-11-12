# RealityLoop agent instructions

This is a standalone, customer-owned robotics simulation and evaluation repository, intended to be a Git submodule of Taskyon. No Taskyon account, cloud, Space or closed provider is needed for local simulation or CI.

- Preserve clean boundaries: customer-owned models, sensors, controllers, scenarios and assertions; optional Taskyon Design Graph adapter and P2P publication at the edge.
- Default physics is compiled Rumoca Modelica with five simplified fixed box contacts; legacy Rapier is opt-in. The detour currently has material compliant shelf penetration and is NOT a collision-free/safety-qualified route. Do not double-integrate robot state or claim realistic 3D multibody/contact geometry.
- Official MuJoCo 4.0.1 WASM collision-only calls work in an independent reference; `modelica/RealityLoopMuJoCo.mo` and `native/realityloop_mujoco.*` are uncompiled, unlinked external-C interface source. Never claim these run inside Rumoca until native/WASM linking and ExternalObject semantics pass tests. Prefer generic replaceable Modelica packages, not hardcoded MuJoCo/Rapier compiler changes.
- Require machine-readable results, bounded execution, explicit seeds/time steps, deterministic ordering, captured nondeterministic inputs and exact toolchain digests before claiming reproducible replay.
- Sensor output is synthetic: 5 multi-elevation 3D LiDARs, 2D PCL WASM ICP scan matching + occupancy mapping, front rendered RGB, generated gyro and encoder signals, rear/depth metadata. PCL ICP is external scan registration, NOT full SLAM with loop closure. Never claim Tennant sensor calibration, realistic noise, depth pixels, measured vehicle dynamics, or BrainOS integration.
- The planned image-to-scene workflow must retain the source reference image(s), camera calibration/pose, scene revision, selected renderer, render output and quantitative comparison. Keep collision geometry explicit; splats are appearance, not physical truth.
- Avoid arbitrary code execution or broad filesystem/P2P capabilities from scenario data, untrusted model artifacts or simulated agents. Worker publication uses a narrow folder/namespace grant; no Space root keys.
- Add meaningful tests for changed behavior and update parent `SYSTEM_DEFINITION.csv` in the same change. Check `npm run check && npm test && npm run build && npm run build:web`; use headless Chromium where rendering or WASM/browser loading changes. Never claim real vehicle fidelity or 0.7.1 acceptance without evidence.
- Keep the public simulation API small and usable from Node/CI; graphics must be optional. External robot middleware uses explicit adapters and never requires changes to a customer's OS.
- Do not commit generated runs, private robot models, customer data, secrets, or large photos.
