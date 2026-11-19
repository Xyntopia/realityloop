# RealityLoop collision geometry and Modelica query backends

## Implemented data flow

```text
assets/meshes/supermarket-layout.json (authoring input)
      |
      | npm run build:collision-assets
      v
assets/meshes/supermarket-layout.glb [SHA-256]
      |                               |
      | build-collision-assets.mjs    | Three.js GLTFLoader on demand
      v                               v
src/generated/supermarket-obstacles.ts  debug visualization
      |
      +--> src/geometry.ts --> lidar / renderer / clearance
      |
      +--> src/modelica/scene.ts --> Modelica parameter arrays
      |                              |
      |                       RealityLoopCollision.circleAabb2D
      |                              |
      |                       RealityLoopContacts.SupermarketRobot
      |                              |
      |                        Rumoca / WASM physics
      |
      +--> collision-only Rapier / MuJoCo query scenes (optional)
```

The GLB is a **compiled, immutable runtime geometry asset**, not an external
simulation engine. Its source manifest is the single editable definition of
the supermarket's five physical collision boxes. Regenerate and check:

```sh
npm run build:collision-assets
npm run check:collision-assets
npm run check && npm test
```

The compiled TypeScript constants are *extracted from the GLB* with a strict
parser. No independent TS or Modelica hand-maintained obstacle list is used
during a supermarket run. The checked-in default Modelica source retains its
parameter-array fixture for standalone source compilation; the production
execution always replaces those values from the generated geometry.

The Three.js overlay visualizes the *collision envelopes*, not detailed
products or structural CAD. The default supermarket uses fast 2D analytic
circle-vs-box contact; an opt-in `SupermarketMeshRobot` variant now
redeclares the contact function to query actual 3D GLB fixture triangles.
The moving robot remains a conservative sphere-at-mid-height approximation,
not a 3D scanned robot hull. Decorative geometry is not physical.

## Supported imported assets

- **GLB 2.0**: Embedded JSON/BIN, multiple indexed triangle primitives,
  node hierarchy and transforms. By default only nodes explicitly tagged
  `extras.realityloopCollider` become physical. Explicit `--all-meshes`
  opts in to collision conversion of otherwise untagged visual nodes.
  Unsupported compression, external buffers and malformed accessors fail
  closed.
- **OBJ**: Geometry vertices and positive/negative face indices. Convex,
  coplanar n-gons can be triangulated; concave, nonplanar or degenerate
  polygon faces require CAD-side triangulation. Visual materials are ignored.
- **STL**: ASCII or binary triangles. OBJ and STL units may be `m`, `cm`
  or `mm` via an explicit converter option.

```sh
npm run compile:collision-mesh -- component.obj Component.mo --solid --package=Component
npm run compile:collision-mesh -- component.obj Component.mo --solid --package=Component --check
```

The converter writes a Modelica package plus a hash-locked `.mo.json`
manifest with geometry and BVH statistics. `--solid` requires outward,
edge-manifold, watertight surfaces; it does not establish geometric
non-self-intersection. Unchecked inputs are still treated as untrusted.

The generated Modelica package includes 3D vertices, 1-based triangle
connectivity, per-body offsets, bounding boxes and deterministic per-body
BVH arrays. `sphereTriangle`, `sphereClosedMeshRegion` and
`sphereClosedMeshBvh` evaluate nearest points, surface normals and signed
penetration in *compiled Modelica*. The BVH is an acceleration structure,
not itself a collision algorithm. The BVH narrow-phase regression matches
brute force; a tiny 12-face box shows no measurable pruning advantage and
must not be advertised as a speedup. Arbitrary triangle-mesh-vs-triangle-mesh
contact and manifolds remain future work.

All import files have fixed size and vertex/triangle budgets. The source
generator is deterministic and the GLB output is validated by both the custom
parser and Three.js `GLTFLoader` in CI.

## Modelica contact interface

`modelica/RealityLoopCollision.mo` provides
`RealityLoopCollision.circleAabb2D(x,z,cx,cz,halfX,halfZ,radius)` returning
`{penetration, normalX, normalZ}` and 3D sphere-to-triangle/closed-solid
queries. `modelica/RealityLoopContacts.mo` uses a `replaceable function`
with an analytic default; `SupermarketMeshRobot` redeclares it with
`RealityLoopMeshCollision.importedBoxContact`. Both versions retain all
contact forces, steering, slip, and vehicle dynamics inside Rumoca's
Modelica solver. Tests exercise arrival, blocked contact, and force response.

The `modelica/RealityLoopCollisionHost.mo` example exposes the same
high-level **penetration query** to a limited, optional host callback:

```modelica
pure function contactDepth
  input Real x;
  input Real z;
  input Real yaw;
  output Real depth;
  external "C" RumocaHost_externalReal3(x,z,yaw,depth);
end contactDepth;
```

Its callback is synchronous inside the Modelica solver. The optional host
creates the query scene once, then calls either:

- `Rapier.Shape.contactShape` (no `Rapier.World` or dynamics timestep)
- MuJoCo `mj_kinematics` + `mj_collision` (never `mj_step`)

Both return contact depth through the same host call, affecting a Modelica
differential equation. Query adapters also provide contact point and surface
normal diagnostics in their TypeScript contract, but **those additional
outputs are not yet exposed through the three-input/one-output WASM host ABI**.

Only a separately built patched Rumoca WASM supports this callback; the
published `@taskyon/rumoca` dependency does not provide a generic native C
linker, `ExternalObject` lifetime API, or this host integration automatically.
The default never falls back to JS when a Modelica call fails.

Run the optional host tests with:

```sh
RUMOCA_EXTERNAL_C_WASM_DIR=build/rumoca-host \
  node --experimental-strip-types --test tests/external-collision-host.test.ts
```

## Next implementation boundaries

1. **Richer 3D contact geometry:** current native narrow-phase supports sphere
   against triangle meshes, not articulated rigid-mesh-to-rigid-mesh contacts,
   oriented polyhedra, manifolds, self-intersection detection or convex
   decomposition. Those need independent fidelity and energy-stability gates.
2. **Reusable backend records/arrays:** `replaceable` functions now work and
   the opt-in patched host runs Rapier/MuJoCo penetration queries inside a
   Modelica-controlled *full supermarket model*. A scalar real3 callback is
   still inadequate for 3D contact points, multiple normals or native
   `ExternalObject` resource lifecycles. Never advance two integrators.
3. **Performance and robustness:** profile BVH traversal, compiler time,
   WASM memory, physical stiffness and contact energy for complex imported
   scenes; the 12-triangle shelf does not benefit from BVH pruning.
4. **Reproducible cross-backend comparisons:** require per-backend geometric
   parity, contact normals, force consistency, versioned source/asset hashes
   and explicit Taskyon DAG execution locks. The browser still uses stock
   Rumoca Modelica; optional external callbacks require a local patched host.

Until those boundaries are implemented, external providers are validated
**collision-query prototypes**, not advertised as interchangeable production
physics backends.
