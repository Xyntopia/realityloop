# Supermarket renderer performance diagnosis — 2026-11-12

## Method

Run the isolated renderer benchmark with:

```sh
npm run bench:render
```

This requires Playwright and a compatible Chromium browser installed separately; neither is a production dependency. If necessary, set `REALITYLOOP_PLAYWRIGHT` to an existing Playwright package directory and `REALITYLOOP_CHROMIUM` to a Chromium executable. Set `REALITYLOOP_BENCH_OUTPUT` for the JSON destination (default: system temporary directory), or `REALITYLOOP_BENCH_DURATION_MS` for per-case duration (1000–30000 ms, default 4000). The script starts and stops its own temporary Vite server. By default Chromium retains its security sandbox and normal GPU selection; do not force SwiftShader when benchmarking real hardware. Only in an isolated test sandbox, set `REALITYLOOP_BENCH_NO_SANDBOX=1` and/or `REALITYLOOP_BENCH_SWIFTSHADER=1` if those compatibility flags are specifically needed.

`benchmarks/supermarket.html` loads the **actual production supermarket interior** with the photographed floor textures, lights, and instanced shelf products. It uses the fixed 1100×650 eye-level aisle camera, Three.js ACES tonemapping, and PCF soft shadows. The harness changes one rendering factor at a time, reporting RAF frame throughput, CPU rendering-submission time, draw calls, geometry and browser renderer. The isolated scene excludes robot simulation, LiDAR/SLAM, overlays, and the secondary RGB camera, so these numbers isolate display rendering. It uses a software renderer here, **not a physical GPU**. Ablations intentionally change appearance and are **diagnostics only**.

The following figures are a **pre-atlas baseline** from two runs in headless Chromium using ANGLE/SwiftShader software Vulkan, ~3 s / ~2.5 s per case. They are not current post-optimization performance claims:

| Static visual scene | RAF FPS | Draw calls |
| --- | ---: | ---: |
| Empty scene | ~60 | 0 |
| High PBR, 1.0 DPR | 0.9–1.2 | 63 |
| High PBR, 0.48 DPR | 3.4–3.7 | 63 |
| High PBR, shadows disabled | 1.1–1.2 | 63 |
| High PBR, floor hidden | 1.5–1.6 | 62 |
| High PBR, decorative product stock hidden | 2.6–2.8 | 38 |
| High PBR, entire merchandise rack hidden | 4.0–4.3 | 7 |
| High PBR, product materials switched to textured Lambert | ~1.9 | 63 |
| High PBR, entire scene overridden to Lambert | ~5.9 | 63 |
| High PBR, entire scene overridden to unlit materials | 15.6–16.5 | 63 |
| Performance stock/lighting, 1.0 DPR | ~8.1–8.5 | 39 |
| Performance stock/lighting, 0.48 DPR | 17.9–20.8 | 39 |

These are approximate short-run measurements, not stable hardware acceptance thresholds. The High and Performance cases were repeated at the end to check warm-up/order effects. JS frame submission was typically under ~2 ms while animation frames arrived much less often, which suggests rendering/compositing rather than simulation scripting is dominant on this software backend. Submission time must **not** be interpreted as GPU elapsed time.

## Independent simulation/sensor timings

Node.js `runExperiment` on `scenarios/modelica-supermarket-detour.json` (without Taskyon storage or browser): 1,662 ms on first run and 560 ms on second run in the same process. The replay contained 308 observations. Deriving all sensor observations from the warmed trajectory averaged ~7.8 ms and emitted 15 LiDAR capture times; a standalone five-unit LiDAR scan averaged ~0.5 ms across 25 warmed runs. This establishes that **live display rendering is the dominant throughput limitation on this benchmark**, not that compilation/SLAM will always be cheap across more complex scenarios.

## Conclusions and next experiments

1. **Material/shader cost is primary on SwiftShader.** Unlit full-resolution rendering is over 10× faster than high-PBR with the same draw count. Use simpler materials for distant/side-facing products while retaining selected high-quality near-field materials; benchmark image quality alongside speed.
2. **Pixel fill is material.** Reducing DPR from 1.0 to 0.48 improves High mode by ~3× and Performance mode by ~2×. Keep an adaptive DPR budget for lower-end devices.
3. **Dense stocked shelves amplify shading overhead.** Hiding individual product meshes boosts High mode ~2–3×; hiding the entire rack yields ~4×. Test material atlases/array textures and near/far SKU LOD, not just fewer meshes.
4. **Shadows and the PBR floor are secondary in this particular software test.** Disabling shadows alone changes FPS only modestly; the floor costs some time but does not account for the huge PBR/Performance gap.
5. **Real hardware is still unmeasured.** Run the same harness in a hardware-accelerated browser with vendor/driver recorded, then benchmark the full live robot/sensors and compare screenshot differences. SwiftShader can strongly exaggerate physically based shading expense and should not dictate the final visual-quality default.

## Atlas, packaging geometry and shelf batching follow-up

The current scene now uses a shared, edge-padded 24-SKU canvas atlas; four
`THREE.BatchedMesh` packaging groups reuse **indexed SKU geometry** and
per-item transforms (rather than baking all instances into expanded triangles).
A common stock texture, cheaper diffuse paper packaging, optional six-segment
can/bottle caps, and batched shelving across fixtures reduce materials and
draw submissions. High quality preserves photographed terrazzo maps, specular
metal/plastic and lights; Balanced/Performance reduce shader cost. A fixed
radial contact-shadow plane under each shelf is decorative only, and is disabled
in Performance. An automated FPS hysteresis policy selects graphic tiers.

The later supermarket scene also adds visual-only, textured palletized goods,
printed shelf endcaps and a distant cooler-wall image; its actual standalone
browser screenshot (with those decorations) rendered **30 draws**, **46,706
triangles**, **~0.84 FPS at 0.65 DPR** in one short High quality software-run.
This is a screenshot smoke check, not an optimized throughput measurement.

Short follow-up software Chromium measurements after the preliminary
non-indexed atlas bake varied considerably with order, renderer warm-up and
other sandbox workload. Even at 27 High/21 Performance draw calls, the latest
indexed-batch test measured **~1.45 FPS High at 0.48 DPR**,
**~0.72 FPS Balanced at 0.7 DPR**, and **~8.3 FPS Performance at 0.48 DPR**
(1100×650 viewport), with no page errors. These numbers are from one brief
run before a subsequent six-segment cap simplification. This is **not** a
demonstrated FPS speedup over the 63/39 draw baseline, nor a real-GPU
acceptance result. In particular, shader cost and the multi-draw/instance
implementation on SwiftShader may negate reduced draw calls.

Benchmark cases can be selected with
`REALITYLOOP_BENCH_CASES=performance-0.48,balanced-0.7,high-0.48`.
Priorities now are (a) compare both SKU batching paths on target physical
GPUs, (b) compare GPU timings rather than JS submission alone, and (c) only
then raise graphical fidelity further using scanned, licensed assets and
calibrated illumination.

## Whole-page robot-batching smoke

In the complete live supermarket example, the fixed Tennant body geometry is
now grouped by shared material using `viewer/static-robot-batcher.ts`. The
steering wheel and printed decals remain independent objects; all chassis,
wheel, brush and visual LiDAR mount batches are rigidly transformed by the
same root pose. They do **not** change solver state, sensor extrinsics or
robot collision geometry.

A single headless Chromium aisle-view run at 1100×650 with **Performance**
graphics (0.48 DPR on this environment) reported **17 FPS, 43 draw calls,
zero JavaScript errors, and COMPLETE · GOAL REACHED**. The same page before
this robot batching reported 76 draw calls in a separate High-quality
screenshot check, which is a different configuration and must not be treated
as a controlled A/B FPS measurement.

The new background is painted and far beyond the robot goal. The pallet
cartons are bounded within the canonical obstruction AABB, with a regression
test over changed AABB dimensions. The distant cooler artwork and other
decorations are *not* LiDAR- or collision-visible. None of these visual
additions make the scene a calibrated navigation digital twin.

No simulation geometry, Modelica physics, LiDAR rays, or DAG artifacts are
changed by the renderer or this benchmark.
