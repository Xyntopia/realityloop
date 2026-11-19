# RealityLoop

**A compiler for physical-world experiments:** describe a scenario, execute its simulation as canonical Design Graph nodes, and verify the results before testing real hardware. The supermarket robot and wheel traction lab are examples, not the limits of RealityLoop. **Taskyon UI, cloud services, Space and P2P are not required** to execute, record, inspect or cache experiments. Taskyon/P2P integration is a future optional *transport and visualization* concern—not a runtime dependency.

![Actual RealityLoop supermarket simulation from a customer's eye-level perspective](docs/realityloop-supermarket-shopper-view.png)

*Customer's eye-level view of the supermarket simulation (1.68 m camera).*

## Run

```sh
npm ci
npm run dev                  # local browser example gallery
npm run sim -- examples      # list examples
npm run sim -- scenarios/modelica-supermarket-detour.json runs/detour
npm run sim -- scenarios/modelica-wheel-breakaway.json runs/wheel
npm run sim -- scenarios/modular-satellite-compact.json runs/satellite
npm run sim -- scenarios/mars-rover-traverse.json runs/mars
npm run sim -- scenarios/construction-delivery.json runs/construction
npm run sim -- scenarios/solar-plant-clear-sky.json runs/solar
npm run sim -- verify "$INVOCATION_ID" runs/.dag  # separate uncached replay proof
npm run check && npm test && npm run build && npm run build:web
```

The homepage lists four featured experiments—supermarket cleaning, wheel traction, construction-site delivery, and a utility-scale solar/storage plant—and two further exploratory examples: Mars habitat rover traversal and modular-satellite attitude control. Start the Vite test server with `npm run dev -- --port 5174` (local only) and open `http://localhost:5174/`. The supermarket is at `/examples/supermarket.html` and the traction lab at `/drive-lab.html`; neither is the definition of RealityLoop. Use `npm run dev -- --host 0.0.0.0 --port 5174` only on a trusted network.

Homepage cards have shareable, stable fragments: `#supermarket`, `#wheel-slip`, `#construction`, `#solar`, `#mars`, and `#satellite`. For example, `https://realoop.xyntopia.com/#supermarket` on GitHub Pages opens the **homepage**, scrolled to the supermarket card, rather than launching the simulator. Each card links directly to its executable model source, a runnable example scenario, and a concise fidelity/limitations note: supermarket, wheel-slip, and the satellite's **Keplerian orbital formation** use **Rumoca-compiled Modelica**; construction, solar and Mars rover physics and the satellite's independent attitude/inspection pipeline use reduced-order TypeScript models. The metadata is owned by `src/examples.ts` and the code links point to the public RealityLoop GitHub repository. Header links navigate to `#examples`, `#other-experiments` and `#how-it-works`. The latter also links to the related [Taskyon design-workspace documentation](https://taskyon.space/docs/taskyon/user/design-workspaces.md), design graphs, inspectable task trees, and Modelica integration; all are optional reading, not runtime dependencies.

The homepage's **Other experiments** section also links to external Rumoca/CogniPilot ecosystem examples under `#rumoca-examples`: SLAM Lab, the fixed-wing Modelica workbench, a motion-capture system-identification benchmark viewer, a reusable-booster teaching demo, the browser playground, and all 13 official Rumoca tutorials listed in November 2026. These open upstream projects; **none run through RealityLoop's Taskyon Design Graph execution, artifact locking or replay verification**. This is a provenance and execution-scope distinction, not a claim that upstream projects lack their own test or reproducibility tools. The motion-capture web viewer displays exported benchmark data rather than simulating Modelica in-browser, and SLAM Lab's full visual-SLAM pathway remains experimental. The external list is plain, inspectable HTML, without copied imagery or runtime dependencies. Links and distinctions are exercised in the homepage browser regression.

## Mesh geometry and Modelica-first collision architecture

The supermarket's five *physical* fixture envelopes now have a single source:
`assets/meshes/supermarket-layout.json`. Run `npm run build:collision-assets`
to regenerate the deterministic, self-contained
`assets/meshes/supermarket-layout.glb` and
`src/generated/supermarket-obstacles.ts`; the latter is extracted from
the **compiled GLB**, not an independently authored obstacle list. The GLB
SHA-256 is exported by `src/geometry.ts`; `npm run check:collision-assets`
checks both outputs before CI accepts a build.

`src/collision/mesh-import.ts` reads embedded glTF 2.0 GLB nodes with
`extras.realityloopCollider` (`id`, `kind`, `type`), local transforms,
vertices and indexed triangles. Untagged GLB meshes may be imported as
collision meshes only with explicit `--all-meshes` consent.
`src/collision/mesh-formats.ts` also accepts OBJ and ASCII/binary STL.
Import validates size, finite coordinates and topology. Ambiguous concave
or nonplanar OBJ polygon faces must be triangulated in the CAD tool.
`src/collision/modelica-compile.ts` emits deterministic Modelica vertex,
triangle, body-offset and BVH parameter arrays; its solid mode requires
watertight, consistently wound surfaces. To import *your own* assets:

```sh
npm run compile:collision-mesh -- rover.stl RoverMesh.mo --units=mm --solid --package=RoverMesh
npm run compile:collision-mesh -- rover.stl RoverMesh.mo --units=mm --solid --package=RoverMesh --check
npm run compile:collision-mesh -- building.glb BuildingMesh.mo --all-meshes --package=BuildingMesh
```

The resulting `.mo` and `.mo.json` record executable geometry and source/output
hashes, respectively. Connecting an imported Modelica package to a new vehicle
still requires an explicit physical model; loading a visual mesh alone must
not silently assign it physical collision or contact behavior.

## Renewable power plant: realistic visualization, reproducible reduced-order physics

Open `/examples/power-plant.html` to explore a **synthetic 2.88 MWdc / 2.5 MWac PV plant** with 192 north–south-axis tracking tables, one central inverter, 1 MW / 4 MWh battery container, electrical yard, transformer equipment and substation, security perimeter and maintenance access roads. The model runs as the **same Taskyon Design Graph scenario → simulation → metrics / observations chain**, in the browser and CLI. The viewer provides a draggable 3D camera (inspection, overview, electrical yard), day/timeline controls, tracker/fixed mounting, export power cap, battery toggle, temperature, electrical metrics and a generation/SOC chart. Regenerate the gallery image from the actual running 3D scene with `npm run capture:solar`; run the deployed build regression with `npm run check:browser:solar`.

The scene adapts **equipment envelopes, tracker orientation conventions and instancing ideas** from Joulios `feature/darden-study`: `src/modules/packing/layout3dScene.ts` and `joulios/graph/nodes/HybridPlantLayoutOptimizerNode.ts`. This is a standalone reimplementation of a *representative* utility-scale layout, **not a copy of a customer’s land parcel, a certified site, a completed Joulios layout optimization run or an actual Darden asset**. It does not import Joulios at runtime.

The executable physics is a deliberately reduced-order **clear-sky solar-position / plane-of-array irradiance / temperature-derated DC generation / inverter efficiency and clipping / export-limit and constrained BESS dispatch** model, with power-balance checks and integrated daily exported/curtailed energy. Solar-time, synthetic cloud-free weather and simplified row-shadow losses are explicit. **Not yet modeled:** actual measured weather, horizon and vegetation shade, electrical network protection, battery degradation, site-specific inverter curves, string or transformer impedance, terrain-ground shadows in energy calculations, validated PVGIS/SAM/PVsyst estimates or real BESS dispatch scheduling. The beautiful scene is **not** proof of a physically validated plant.

PV panels use procedural solar-cell maps, clearcoat PBR, metal frames and instanced tracker supports; outdoor lighting uses a simulated directional sun, dynamic hardware shadow maps, a low-cost software-renderer contact-shadow fallback, terrain textures and atmospheric shading. Real GPU frame rates have not been measured. The checked-in gallery thumbnail is a capture from the running simulator, not a photograph or AI-generated concept image. Generated design references may be kept separately under `docs/references/` when the actual files are available and identified as concept art.

## New mission examples: reconfigurable spacecraft and field robotics

The **modular satellite** example is informed by *Design Automation and Performance Analysis of Modular Reconfigurable Attitude Control Systems* (Meschede, TU Berlin, 2019, DOI [10.14279/depositonce-8949](https://doi.org/10.14279/depositonce-8949)). The procedurally built 40 cm modular bus has interfaces, reaction-wheel hardware, solar arrays and three selectable mass layouts. The existing rigid-body **full inertia tensor / Euler / bounded reaction-wheel PD / quaternion** solver remains a separate reduced-order subsystem. A new **Rumoca-compiled [KeplerFormation.mo](modelica/KeplerFormation.mo)** propagates both chief and free-flying inspection servicer from classical orbital elements: semimajor axis, eccentricity, inclination, RAAN, argument of periapsis, and initial mean anomaly. All six orbital elements are editable in the browser and stored explicitly in the JSON input scenarios, with strict input bounds. Modelica solves Kepler's equation for both spacecraft, records ECI positions and analytic Keplerian ECI velocities, and transforms their relative displacement into the chief's radial/along-track/normal (RTN) frame without finite-difference velocity errors. The default LEO example has a ~94.6-minute orbit and starts ~10.4 m apart. The 100-second example does not imply a full-orbit replay; its 2,001 samples are at physical simulation times. This is **point-mass two-body Kepler propagation**, without J2, drag, solar radiation pressure, third bodies, station-keeping thrust or measured ephemerides; orbital elements are an input representation, not inherently more precise than Cartesian states.

A second **inspection servicer** is propagated on a neighboring Keplerian ellipse and carries a synthetic planar range scanner. Deterministic rays intersect a projected target module/solar-wing silhouette with shared renderer geometry; target-relative positions are rotated into the bus frame using the full attitude quaternion. A coarse initial pose prior, noisy relative odometry and iterative closest-point (ICP) registration accumulate a 2D target-body-frame map every ~2 seconds. Scan snapshots and registration residuals are recorded in the Taskyon DAG observation artifact, distinct from terrestrial LiDAR. This demonstrates part of a SLAM-style mapping pipeline, **not** an operational 6DoF spacecraft localization and mapping system: no true 3D surface returns, photogrammetry, independent attitude estimation, propulsion control, sensor noise calibration, loop closure or docking guidance. Target/servicer/planet distances and sizes are visually compressed in the Three.js viewer but never in the recorded SI orbital state. The displayed planet center is on the negative radial axis of the chief's RTN frame; formation, chief and servicer camera presets are visual only. Hardware WebGL2 gets optional half-resolution SSAO and sun-cast shadows; software renderers retain a low-cost fallback. Neither is flight-validated rendering.

The Earth globe still uses the locally bundled **2048×1024 NASA Blue Marble: Next Generation (July 2004)** surface map (approximately 219 KB), now under two layers of synthetic, seam-periodic, multi-scale clouds, atmospheric rim shading and modest cloud motion. The surface image needs no runtime NASA request. [Asset provenance and usage terms](assets/textures/README.md) remain bundled; procedurally generated clouds are **not observed weather**, and the display globe is not geodetically scaled to the recorded orbit.

The modular spacecraft and Martian habitat scenes are inspired by modular-robotics/iBOSS engineering concepts, but neither qualifies real docking hardware. The earlier two-block point-mass docking demo has been retired because its simplified capture model did not meaningfully represent the system.

The **Mars habitat construction & rover** example generates a procedural deployment site with 18 orange modular habitat blocks, circular interface plates, two assembly manipulators, a legged cargo robot, a scouting rover, and a six-wheel delivery rover. Its floor now uses independent procedural iron-rich regolith albedo **and normal maps**, weathered sediment staining and instanced basalt fragments; static under-body, habitat and cargo contact footprints improve grounding even on software renderers. Warm directional sunlight, hardware shadow maps, optional half-resolution SSAO on hardware WebGL2, and restrained dusty atmospheric fog improve depth without changing physics. Repeated panels, frames, interfaces, indicator lights and rocks are GPU-instanced. No third-party photographs or real-site scans are embedded.

The **runnable physics scenario** remains a rover traverse through a canonical synthetic hazard field under Martian gravity (3.71 m/s²), a bounded steering/traction/grade model, and explicit goal/clearance acceptance. Habitat blocks, assembly arms, and support robots are **visual demonstrations only**, not modeled manipulator/contact bodies; their animations do not constitute construction-assembly simulation. The rover candidate menu contains **Ares RTG Explorer**, **Helios Solar Rover**, and **Pathfinder Light** with mass/power *concept parameters* from Taskyon's bundled Mars-rover Design Graph example. Selecting a candidate changes the speed/power-to-mass model. There is no mission-calibrated soil, rocker-bogie suspension, validated rover design, physical habitat assembly, onboard SLAM, or site sensor realism. Reproduce the original gallery image with `REALITYLOOP_CAPTURE_SCENE=mars npm run capture:missions`.

The **construction site** example renders a working earthworks site with procedural multi-scale dirt/gravel albedo and normal maps, local compacted lanes and tyre impressions, irregular spoil piles, scattered aggregate, weathered concrete and formwork, an excavator and crane, a cabin, staging materials, barrels and fenced boundaries. Hardware sunlight casts shadows; software rendering uses local contact-shading approximations. All visual assets and textures are generated in RealityLoop. The 16:9 gallery thumbnail is captured from the actual running construction experiment with `REALITYLOOP_CAPTURE_SCENE=construction npm run capture:missions`.

The unchanged **executable dynamics** reuse a reduced-order terrain/traction model at 9.81 m/s² and check goal arrival and conservative circular clearance against three canonical hazards. The additional soil piles, machinery details, fence, stored materials, dust effects and wheel marks are **visual only**; they do not enter the planner's obstacle field, calculated grip, sensors or physics. In particular, wet-looking patches do not model wet-soil traction, and ground/vehicle geometry remains simplified. This is **not** a surveyed construction site or a safety-certified construction planner.

All three mission scenes run the existing **Taskyon Design Graph** node chain and are available as direct browser examples at `/examples/mission.html?scene=satellite`, `mars` and `construction`. Headless CLI JSON scenarios are versioned under `scenarios/`. The orbit Modelica source and compiler WASM digests are part of the satellite browser DAG execution lock. Each page shows the recorded simulation timeline, never a pre-scripted path. The satellite has its **own synthetic planar inspection sensor stream** and scan-map display; Mars and construction still have no simulated onboard sensor suites. Supermarket LiDAR and camera mounts are never silently reused in these worlds.

Gallery images are original 16:9 **live 3D viewport captures**, reproduced with `npm run capture:missions` using Playwright. Only the gallery-capture process hides the surrounding controls; interactive mission pages retain their full UI. No temporary visual reference images, thesis figures, or third-party satellite CAD are included in the build. The one intentionally bundled Earth image is the NASA Blue Marble runtime texture credited above.

## Taskyon-family visual identity

The standalone gallery, supermarket controls and traction lab share `viewer/theme.css`, using **primary slate `#2A3548` and secondary orange `#F78F3B`**. The optional Taskyon olive accent is intentionally not part of the everyday RealityLoop interface. Diagnostic overlays use orange and neutral white/slate for distinct data series. The `public/realityloop-icon.svg` logo uses an Erlenmeyer flask, a vernier caliper and a simple iteration loop; it is shared by the gallery, viewers and browser favicons. Scene materials, robot paint, products and sensor calculations do **not** inherit brand colors.

## GitHub Pages deployment (static demos)

The independent repository has a GitHub Actions workflow at `.github/workflows/pages.yml`. GitHub `main` pushes run TypeScript and simulation tests, build the multi-page Vite gallery at the domain root (`/`), verify paths/assets, and **upload the artifact in the build job**. A separate deploy job publishes it to Pages. Workflow dispatch is also supported. GitHub Pages is configured with the custom domain `realoop.xyntopia.com`; the DNS provider must set a `realoop` CNAME to `xyntopia.github.io`, then GitHub issues the HTTPS certificate. No CNAME file is needed for the GitHub Actions deployment.

**One-time repository setup is required:** in **GitHub → Settings → Pages → Build and deployment → Source**, select **GitHub Actions**. The initial deployment failed because Pages was not enabled (HTTP 404 in `actions/configure-pages@v5`); the workflow now emits a specific configuration error while preserving the successful build artifact. The standard `GITHUB_TOKEN` cannot enable Pages through `configure-pages`'s `enablement: true` option. Site initialization requires repository administration, not an extra token embedded in the workflow.

The repository has both `github` (`git@github.com:Xyntopia/realityloop.git`) and `origin` (`git@gitlab.com:xyntopia/realityloop.git`) remotes. Only GitHub pushes trigger GitHub Actions. The workflow does not modify remotes or expose credentials; the resulting static site is public.

To test the custom-domain-root Pages layout locally:

```sh
npm run build:web -- --base /
node --test tests/pages-build.test.mjs
```

The default test base is `/`; `REALITYLOOP_PAGES_BASE=/` makes that explicit in CI. The static Pages site runs existing browser DAG simulations **locally in the tab**. It does not host an always-on agent or expose P2P/RPC endpoints. Authorized Taskyon remote DAG-node execution is a separate **planned v0.7.1** capability.

The deployed supermarket previously had two runtime faults: repeated trail
buffer warnings from per-frame `BufferGeometry.setFromPoints`, and a fatal
`pcl.js` ICP constructor error when production minification renamed
`PointXYZ.name`. The trail now preallocates a whole immutable replay trace
and only advances `drawRange`; the Vite build preserves constructor names,
checks WASM compatibility at initialization, and switches transparently to
the grid fallback if PCL later fails rather than crashing replay. The Pages
artifact tests check the class-name invariant, and **GitHub Pages deployment
is now gated by a real Chromium smoke test**. Locally, after a Pages-base
build, run `npx playwright install chromium` once, then
`npm run check:browser:prod`. It completes the entire recorded Modelica
detour replay, checks actual ICP registrations and rejects JavaScript errors
or growing geometry warnings. It also deliberately breaks a PCL constructor
after the successful run to verify that grid fallback keeps replaying.

### Example gallery previews

Both gallery thumbnails are fresh **1440×810 screenshots of RealityLoop itself**:
the supermarket shows its completed Modelica replay and Taskyon-styled controls;
the wheel-traction laboratory shows successfully compiled Modelica trajectories,
charts, and the current navy/orange interface. They are captured by
`npm run capture:gallery` using Playwright/Chromium (not stock photos,
externally sourced screenshots, or synthetic mockups). Regenerate them when the
visual theme changes; the gallery imports the versioned build assets directly.

## Design Graph is mandatory; P2P is optional

Both the headless CLI and browser examples use the **real Taskyon `@taskyon/comp-dag` node engine**. The module is bundled offline in `src/vendor/taskyon-comp-dag.mjs` from `frontend/packages/comp-dag`, with a recorded source and bundle lock at `src/vendor/taskyon-comp-dag.lock.json`. This is a temporary standalone packaging solution, not a second graph implementation. Rebuild only when intentionally updating canonical Taskyon sources:

```sh
npm run build:dag-runtime     # requires local Taskyon source checkout; not needed to simulate
```

The graph is `RealityLoop.Scenario → RealityLoop.Simulation → { RealityLoop.Metrics, RealityLoop.Observations }`. A validated scenario is an invocation input, a simulation result is a Taskyon content-addressed artifact, and derived metrics and sensor observations are separate cached artifacts. The **v2 execution lock** fingerprints every implementation file under `src/`, the dependency lockfile, the selected Modelica source, Rumoca WASM, the canonical DAG bundle and Node runtime version/platform. The filesystem backend implements Taskyon's injected `DagStorageBackend` and `DesignGraphObjectStore` interfaces and persists **Taskyon-format** `GraphRevision`, `InvocationDefinition`, `InvocationRun` and `ProjectRevision` objects under `runs/.dag/`. Repeat runs reuse the local DAG cache; changed inputs or physics sources create distinct invocations. Local filesystem writes currently assume a **single writer**; concurrent workers require a transactional adapter.

Each headless run writes:

- `result.json` — trajectory, metrics and acceptance results
- `sensor-observations.json` — deterministic synthetic IMU/encoder samples, camera metadata and time-sampled 3D LiDAR point clouds where the trajectory exposes a vehicle pose; unrelated experiments explicitly report no sensors
- `run-integrity.json` — input/model/compiler digests, Taskyon graph/invocation/run/project identities and artifact hashes

**Independent replay verification:** `realityloop verify <invocation-id> [store-dir]` reads a stored Taskyon invocation and its artifacts, rejects changed source/runtime locks and corrupt artifacts, then recomputes the physics through a **fresh, uncached DAG store** and compares trajectory, metrics and sensor hashes. The invocation ID is printed by the CLI and recorded in `run-integrity.json`. A cache hit alone is not replay verification. Bit-exact replay across different platforms or solvers is not yet guaranteed.

The browser uses the same canonical DAG nodes, currently with **in-memory caching**. Its lock includes embedded implementation sources, the bundled DAG identity and a digest of the actual Rumoca WASM binary. Persisting/browser-exporting complete Taskyon run records, syncing via P2P, and importing them into Taskyon UI remain outstanding. **Canonical GraphRevision records currently identify trusted bundled nodes, not portable compiled NodeRecords with full module locks**; a Taskyon UI import adapter and module-lock compatibility test are still needed. No external service or network is required for the Node CLI.

## Supermarket example

The Tennant T7AMR-inspired vehicle is **not** a manufacturer model or validated BrainOS implementation. The default Rumoca/Modelica plant owns its planar front-steer/wheel-slip dynamics and analytic contacts with all four stocked shelves plus an aisle obstruction. The smooth detour reaches the goal in about 14.8 simulated seconds with roughly 0.18 m projected swept clearance. Acceptance requires a goal and ≥0.10 m swept-footprint clearance. Legacy Rapier remains opt-in for comparison; no second dynamics engine integrates the same vehicle.

Five synthetic 3D LiDAR point clouds feed a PCL.js WASM ICP scan-registration/2D occupancy demonstrator. The example also renders a front RGB camera and produces IMU/encoder samples; rear RGB and depth streams currently contain metadata rather than image pixels. This is **not** full SLAM with loop closure. Sensor positions and noise are not Tennant-calibrated.

**Procedural PBR visualization:** The supermarket UI includes **Aisle view** for a generic eye-level perspective and **Hide panels** for an uncluttered scene; both modes hide debugging meshes (route/coverage/goal/LiDAR rays) without changing the simulation or LiDAR observations. The viewer uses locally bundled 1K CC0 floor diffuse/normal/roughness maps, reflective shelving, **24 original product package designs across 1,440 indexed-batched product instances in four shared-atlas package groups**, 40 shelf price-strip instances, 35 overhead fixtures, aisle signage, a painted refrigerator backdrop, palletized display boxes, endcap artwork and a light reflection environment. Provenance for the bundled floor material is in `assets/materials/README.md`. These additions are visual-only: physics and LiDAR still use the five canonical obstacle footprints. Third-party development references and their source identifiers are not stored in this repository.

**Realistic** retains the rich textures; **Performance** uses one flat-colored stock draw call, lower render resolution, and disables costly reflections/shadows by default. Software Chromium measured ~1 FPS in High and ~2 FPS in Performance for the aisle-view screenshot tests—**not acceptable real-time performance and not indicative of an actual GPU**. The separate front RGB WebGL preview is now rendered only while its telemetry panel is visible and the page is active (rate-limited by graphics quality); source sensor data remain unaffected. This is validated by `tests/render-policy.test.ts`, but no new on-GPU browser FPS number is yet available. A repeatable browser/scene-layer benchmark is provided by `npm run bench:render` (optional Playwright + Chromium; see [render benchmark and findings](docs/supermarket-render-benchmark.md)). The pre-atlas 2026-11-12 headless SwiftShader baseline isolated expensive PBR material/shader work and pixel fill rate: about 1 FPS for the static high-PBR scene versus 18–21 FPS with Performance LOD. Subsequent atlas/batch work reduced detailed/Performance draw calls to ~27/21 and added diffuse paper shading, six-segment package caps and decorative contact shadows; the software-only follow-up **did not establish a reliable FPS improvement**. These measurements are environment-specific and do not demonstrate real GPU performance. A later full-page browser smoke also batches the stationary Tennant body by material (moving with the same root pose, without changing vehicle physics). In one 1100×650 SwiftShader Performance-mode aisle-view test, the complete scene recorded **43 draw calls, 17 FPS, no JavaScript errors**, and the Modelica route reached its goal. This is a single software-renderer measurement, not a hardware speedup claim or guaranteed steady-state performance. Real GPU profiling remains required. This is a procedural approximation, *not* an almost-photorealistic reconstructed store: genuine scanned products, calibrated lighting and GI would be separate, costly assets.

### Lighting, glare and contact shading

The Three.js browser viewer displays **35 emissive ceiling strips** and batches their soft halos into one draw call. Four nearby point-light clusters approximate their general illumination but do not cast costly shadows individually. The former sun-like directional light and excessive hemisphere fill have been replaced by local ceiling illumination: **one overhead shadow-casting spotlight in Balanced**, **two in Realistic**, and none in the default Performance preset. Shelf uprights/decks and the moving robot cast actual shadows from these sources. Realistic uses two 512px shadow maps; Balanced uses one 768px map. The fixtures do not literally generate global illumination or 35 separate dynamic shadows.

Realistic additionally loads two rectangular area-light groups for broader, view-dependent specular highlights on PBR surfaces. Their ~247 KB LTC support module is lazy-loaded **only on first Realistic use on an accelerated renderer**. WebGL area lights cannot cast shadows, so the spotlights handle that separately. This avoids per-lamp shadow maps, full-room reflection capture and path tracing.

The floor reuses the bundled CC0 1K diffuse/normal/roughness maps plus improved clearcoat and a one-time prefiltered synthetic environment panorama. Shelves and lamp housings reuse small procedural brushed-metal normal/roughness maps. A **384×288 static AO texture** is computed once from the fixed shelf/wall footprints and applied through the floor's second UV set, darkening seams and shelves' footprint regions. This is a fast **procedural approximation of baked indirect-light occlusion**, not a Blender/Cycles lightmap bake, global illumination, or a source of dynamic shadows. Robot contact shading and one/two overhead spotlights remain dynamic. Supported GPUs can add half-resolution eight-sample SSAO in Realistic; Balanced avoids that extra framebuffer pass.

The default Realistic and Balanced lighting has lower ambient fill and slightly lower tone-mapped exposure, giving the local ceiling lights more influence. The reflection environment is approximate and **does not show accurate mirrored shelf/lamp geometry**. These effects are presentation-only and leave Modelica, collisions, LiDAR and DAG observations unchanged.

Dynamic AO now supports **SSAO (default)** and **GTAO (experimental)** under **Customize effects → AO method**. Both render at half scene resolution with eight AO samples. GTAO additionally applies a small denoise pass, and its module is lazy-loaded only when requested on a hardware WebGL2 renderer. While loading or if unsupported, the system retains SSAO; software renderers retain static occlusion and contact shadows only. Compare algorithms reproducibly with `npm run bench:ao`; it uses a development-only software WebGL override and places captured frames/reports in the OS temporary folder, outside the repository. Real GPU timings and subjective quality remain to be validated before using GTAO as a default.

Use the **Graphics** dropdown for **Auto**, **Realistic**, **Balanced**, **Performance**, or **Custom**. The expandable **Customize effects** menu allows independent control of lamp illumination, glare, contact/crevice shadows, hardware SSAO, environment reflections, surface normal/roughness maps, and dynamic shadow maps. Changing an effect automatically switches to Custom, preserving all other choices; a separate scene-detail/resolution selector allows mixed configurations. Glare requires lamp illumination. SSAO is disabled when WebGL2 or hardware acceleration is unavailable. Auto adjusts preset quality based on FPS; manually selected presets and Custom do not downgrade automatically. These are renderer-only options and do not restart or alter the recorded Modelica simulation. Enabling expensive effects on a slow GPU may reduce frame rate.

Reproduce the graphics-tier browser smoke with `npm run check:visual` and an optional Playwright/Chromium installation (`REALITYLOOP_PLAYWRIGHT=/path/to/playwright`). The 2026-11-16 headless software renderer recorded ~15 FPS in Performance and only ~0–1 FPS in richer tiers; these values are not GPU benchmarks and do **not** establish acceptable real-time speed. The effect composition and screen-space AO need separate acceptance on a real GPU.

### Operator screenshot

![RealityLoop supermarket simulation — Taskyon-styled controls and telemetry](docs/realityloop-supermarket-ui.png)

*Operator view from the same running application. Both this screenshot and the customer-eye-level image at the top are reproducible with `npm run capture:readme` and an optional Playwright/Chromium installation (e.g. `REALITYLOOP_PLAYWRIGHT=/path/to/playwright`). The capture script waits for the Modelica/Taskyon graph run and screenshots only the app's browser-rendered scene.*

## Offline H.264 video export (no browser)

`RealityLoop.OfflineVideo` is a **derived Taskyon DAG node**. It consumes an existing recorded `RealityLoop.Simulation` artifact, renders RGB frames in Node.js and streams them directly into FFmpeg. It never reruns Modelica and does not require Chromium, WebGL, Taskyon services or P2P. The output is a **diagnostic 2D top-down trajectory video** for spatial runs or a numeric time-series video for non-spatial experiments; it does *not* yet render the Three.js PBR scene. Video bytes are stored content-addressed under `runs/.dag/media/`, with a canonical video invocation/run and a manifest artifact documenting the codec, encoder version, source invocation, source trajectory hash and renderer hash.

```sh
npm run sim -- scenarios/modelica-supermarket-detour.json runs/detour
INVOCATION_ID=$(node -p "require('./runs/detour/run-integrity.json').dag.invocationId")
# FFmpeg must be available on PATH (or pass --ffmpeg /path/to/ffmpeg):
npm run video -- "$INVOCATION_ID" runs/detour.mp4 --fps 15 --size 960x540
# On NixOS if ffmpeg is not installed:
nix shell nixpkgs#ffmpeg -c npm run video -- "$INVOCATION_ID" runs/detour.mp4
```

An optional end-to-end test exercises actual H.264 encoding with `REALITYLOOP_TEST_FFMPEG=/path/to/ffmpeg npm test`. Source video/artifact integrity is checked independently of the physics simulation.

## MuJoCo / Modelica status

Official `@mujoco/mujoco@4.0.1` WASM separately supports `mj_kinematics` + `mj_collision` contact queries against all five fixtures, without `mj_step`. A **verified opt-in developer probe** in `modelica/RealityLoopMuJoCoHost.mo` uses a patched Rumoca WASM runtime to call official MuJoCo from **inside a Modelica `external "C"` function**. The scalar 3×Real→Real callback returned depth to the Modelica DAE (85 calls and 0.505 m penetration in a deliberate collision test). To reproduce: `npm run build:rumoca-host && npm run test:mujoco-modelica` with the locally patched Rumoca source and appropriate Rust/wasm-bindgen toolchain.

**Limitations:** the full native C shim and `ExternalObject`/contact-array interface are source-only and not compiled/linked; the supermarket still runs analytic Modelica contacts. General native/WASM C ABI support remains a separate architecture goal. The sensor viewer, shell CLI and Taskyon DAG do not substitute JS physics integration for Modelica equations.

## Next steps

Package `@taskyon/comp-dag` as a stable, independently versioned consumer library instead of the pinned bundle; persist browser run records; make generated scenes, assets, controllers and sensor calibrations explicit source-locked graph inputs; optionally publish artifacts into a user-authorized Taskyon Space; and add an optional GPU/PBR-capable offline frame renderer while keeping the current browser-free diagnostic renderer. Physical fidelity, complete 3D collision, robust GPU performance and proper SLAM/pose graph remain separate tasks.

RealityLoop is an independent Git submodule. No changes are pushed automatically. The parent workspace holds the requirements in `../SYSTEM_DEFINITION.csv` and `../proposals/realityloop-simulator-v071.md`.
