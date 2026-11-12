# Native MuJoCo collision ABI — awaiting Rumoca external-C execution

`realityloop_mujoco.h/.c` is a minimal **C ABI shim** around MuJoCo's native C library. It exposes scene creation/destruction and a synchronous collision query; it never steps the MuJoCo dynamics solver.

The companion Modelica package is `../modelica/RealityLoopMuJoCo.mo`, using standard `external "C"` with a persistent `ExternalObject`. Provide a MuJoCo MJCF containing one movable freejoint body and a geom named `robot_sphere`. The query maps RealityLoop ground X,Z to MuJoCo X,Y and returns up to 32 penetration depths and outward contact normals.

For native integration, compile with the matching MuJoCo 4 headers/library and export `realityloop_mujoco` using the platform's normal build/link mechanisms. For browser execution, compile the shim, MuJoCo and Rumoca's execution target into a **compatible linked WASM unit**, or implement a proper imported-function runtime with deterministic, synchronous and memory-safe ABI semantics. The JS-facing official MuJoCo `.wasm` is **not** a drop-in library link input for another independently compiled WASM binary.

**Not yet tested:** C native/WASM compilation, matching MuJoCo library linkage, Rumoca `ExternalObject` support, solver trial-state calls, event crossings and array marshalling. The independently tested working backend uses `../src/mujoco-collision.ts` and official `@mujoco/mujoco@4.0.1` WASM.
### Rumoca implementation boundary

A **limited** scalar Modelica `external "C"` proof is now implemented and tested in the adjacent Rumoca checkout. It uses the exact catalog symbol `RumocaHost_externalReal3` (three Real inputs + a Real output argument) in `../modelica/RealityLoopMuJoCoHost.mo`, and a run-scoped callback to the official MuJoCo WASM `mj_kinematics` + `mj_collision` API. The Modelica solver invokes this callback during actual integration, and the returned penetration influences `der(x)`. The test `../tests/mujoco-modelica-host.test.ts` establishes this without a browser.

The complete C ABI with pointer-owned scenes, contact-normal arrays, and library annotations is **not** yet executable. Rumoca still rejects unrecognized arbitrary external C symbols and cannot run its full `ExternalObject` lifecycle. The `realityloop_mujoco.{h,c}` native shim has not been compiled or linked. Add generic native/WASM linking and array ABI support without introducing a second physics timestep loop.

Acceptance requires a native **and** browser WASM call using the same `external "C"` Modelica function, verified array marshalling, correct handle construction/destruction, deterministic repeated evaluations at arbitrary solver trial states, and contact queries that never step MuJoCo dynamics. Only then switch the active Modelica collision package from analytic geometry to this backend.


Do not silently substitute the JS collision code inside Modelica: that would violate the intended source-of-physics architecture and complicate repeated solver evaluations. Keep the analytic Modelica shelf contact until a proper external-C integration is proven.
