# Native MuJoCo collision ABI — awaiting Rumoca external-C execution

`realityloop_mujoco.h/.c` is a minimal **C ABI shim** around MuJoCo's native C library. It exposes scene creation/destruction and a synchronous collision query; it never steps the MuJoCo dynamics solver.

The companion Modelica package is `../modelica/RealityLoopMuJoCo.mo`, using standard `external "C"` with a persistent `ExternalObject`. Provide a MuJoCo MJCF containing one movable freejoint body and a geom named `robot_sphere`. The query maps RealityLoop ground X,Z to MuJoCo X,Y and returns up to 32 penetration depths and outward contact normals.

For native integration, compile with the matching MuJoCo 4 headers/library and export `realityloop_mujoco` using the platform's normal build/link mechanisms. For browser execution, compile the shim, MuJoCo and Rumoca's execution target into a **compatible linked WASM unit**, or implement a proper imported-function runtime with deterministic, synchronous and memory-safe ABI semantics. The JS-facing official MuJoCo `.wasm` is **not** a drop-in library link input for another independently compiled WASM binary.

**Not yet tested:** C native/WASM compilation, matching MuJoCo library linkage, Rumoca `ExternalObject` support, solver trial-state calls, event crossings and array marshalling. The independently tested working backend uses `../src/mujoco-collision.ts` and official `@mujoco/mujoco@4.0.1` WASM.

Do not silently substitute the JS collision code inside Modelica: that would violate the intended source-of-physics architecture and complicate repeated solver evaluations. Keep the analytic Modelica shelf contact until a proper external-C integration is proven.
