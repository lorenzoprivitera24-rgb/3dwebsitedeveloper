# Photoreal 3D on the web — research dossier (2026)

> Provenance: distilled from a deep-research run (≈110 fan-out agents, 33 deduplicated sources, 23 claims that survived 3-vote adversarial verification, plus 10 capability-area briefs). Every load-bearing assertion below was re-checked against primary sources in a second fact-check pass; where the verdict **refuted** or **corrected** the original claim, this dossier states the corrected form and flags it. **Core thesis:** a believable real-time 3D environment on the web in 2026 is a disciplined composition of *instanced billboard/card geometry + node-material PBR (TSL) + IBL & filmic tonemapping + a native-WebGPU post chain + multi-layer GPU wind*, NOT solid procedural geometry and NOT a port of an offline renderer. **Honest ceiling:** the realistic target is "excellent WEB 3D" — Bruno-Simon / top-Awwwards / Codrops *False Earth* tier (believable PBR, glassy transmission, GPU grass) on a budget of ~1.5–3M on-screen triangles desktop / ~500K mobile and draw calls in the low hundreds. It is **not** UE5 Nanite / GTA V / RDR2 engine tech (virtualized geometry, full real-time GI, virtual shadow maps do not run in a browser). For a pixel-faithful photoreal hero, the only honest path is a **baked render or video backdrop** with interactive 3D as a secondary layer.

This is the broad, cross-cutting consolidation. The foliage-specific playbook lives in [`realistic-foliage.md`](./realistic-foliage.md) and is one slice of what follows — it is referenced, not repeated.

---

## The 9 verified findings

### Geometry

**1. Dense organic detail = instanced alpha CARDS, not solid geometry (verified 3-0).** The professional standard for foliage/dense detail is textured alpha-tested quads / cross-quads (leaf cards, billboards), instanced en masse — *not* procedural boxes and *not* per-leaf sculpted geometry. A solid box has no frastagliated silhouette or layered parallax; replicating that with real geometry costs hundreds of thousands to millions of triangles per bush/tree. Small plants/grass = pure cards; large assets (trees, tall hedges) = cards for the leaf mass + standard solid geometry for trunk/major branches. Do: author cross-quad cards from a leaf atlas, instance them, keep the cards light. Sources: [80.lv vegetation/alpha cards](https://80.lv/articles/human-emotions-creating-vegetation-with-alpha-cards), [Polycount foliage wiki](https://wiki.polycount.com/wiki/Foliage), [Bruno Simon case study](https://www.awwwards.com/brunos-portfolio-case-study.html), [Polycount alphas-vs-geometry](https://polycount.com/discussion/144594/foliage-alphas-vs-geometry).

**2. InstancedMesh is the core scalability lever; draw-call budget is necessary but not sufficient (verified 3-0).** Each separate mesh is a draw call — keep total meshes "no more than 1000 as the very maximum, and optimally a few hundred or less" ([R3F scaling-performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance)). `THREE.InstancedMesh` collapses "hundreds of thousands of objects in a single draw call." For dense fields use **native `THREE.InstancedMesh`** (per-instance matrix + `InstancedBufferAttribute` for hash/wind-phase/color); drei `<Instances>` is the wrong tool at foliage scale (see Refuted §). The *real* bottleneck is the on-screen triangle/vertex budget (~3M sweet spot desktop), not draw calls alone — so cards stay light + LOD + chunking. For many DISTINCT geometries under one material, `THREE.BatchedMesh` (r156+, works under WebGPURenderer with TSL node materials) is the right tool and exposes per-instance frustum culling via the `perObjectFrustumCulled` boolean (default true). Sources: [R3F scaling-performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance), [drei Instances](https://drei.docs.pmnd.rs/performances/instances), [grass-shader-glsl (400k+ blades)](https://github.com/Nitash-Biswas/grass-shader-glsl), [InstancedMesh-vs-BatchedMesh forum](https://discourse.threejs.org/t/how-to-choose-between-instancedmesh-and-batchedmesh/81221).
> ⚠️ **Corrected (fact-check):** core `BatchedMesh` has **no native per-object geometry LOD**. The method is `setGeometryIdAt(instanceId, geometryId)` (reassign to an already-added geometry), **not** `setGeometryIdForInstance`, and that is not an LOD mechanism. Per-object LOD exists only in the third-party `@three.ez/batched-mesh-extensions` (`addGeometryLOD()`), which is **WebGLRenderer-only, not WebGPU**. For per-object LOD on WebGPU today: use drei `<Detailed>` for a handful of hero objects; for large fields, distance-driven impostors or hand-rolled geometry swap. Verify the exact 0.184 `BatchedMesh` API surface in source before wiring.

### Material & shading (PBR + TSL)

**3. Thin alpha edges → `alphaHash` kept opaque, resolved by temporal AA (verified 3-0).** `material.alphaHash = true` (on `MeshStandardMaterial`/`MeshPhysicalMaterial`, since r154, present in 0.184) renders the material **opaque** — the official `webgl_materials_alphahash` example sets `transparent = false; depthWrite = true` — which sidesteps the back-to-front sorting problems of true transparency for overlapping leaf cards. The cost is a dithered/noisy result that requires **TAA/TRAA (or SSAA), NOT MSAA**, to clean up; the official example pairs it with a `TAARenderPass` (sample level 0–6). The alternative `alphaToCoverage` needs an MSAA context and smooths clip edges directly; hard `alphaTest` is the cheap binary cutout. Choose per case; verified default for overlapping leaf cards = alphaHash + temporal AA. Sources: [official webgl_materials_alphahash](https://threejs.org/examples/webgl_materials_alphahash.html), [Material.alphaHash docs](https://threejs.org/docs/#api/en/materials/Material.alphaHash), [alpha-test-vs-alpha-hash forum](https://discourse.threejs.org/t/alpha-test-vs-alpha-hash/44493).

**4. Backlit translucency via two-sided transmission/SSS — NOT the mattdesl shader-chunk gist (verified 3-0; gist refuted 0-3).** The single biggest "alive" cue for vegetation (and a premium cue for glass/wax/curtains) is light passing through the surface. Implement with a two-sided foliage shading model + subsurface/transmission: in three.js use `MeshPhysicalNodeMaterial` (`side: DoubleSide`, `transmission`, `thickness`/`thicknessNode`, `ior`, `attenuationColor`/`attenuationDistance`) or a dedicated SSS node. Channel-pack roughness + transmission + colour-mask into one map, alpha in diffuse, normal separate (80.lv workflow). **Do not** inject SSS via shader chunks into `MeshStandardMaterial` (the mattdesl gist — refuted 0-3). Sources: [80.lv alpha cards](https://80.lv/articles/human-emotions-creating-vegetation-with-alpha-cards), [NVIDIA GPU Gems 3 Ch.16](https://developer.nvidia.com/gpugems/gpugems3/part-iii-rendering/chapter-16-vegetation-procedural-animation-and-shading-crysis), [procedural-grass-threejs](https://github.com/CK42BB/procedural-grass-threejs).
> ✅ **Fact-check confirmed for 0.184:** `MeshPhysicalNodeMaterial` exposes working node props under the WebGPURenderer — `transmissionNode`, `iridescenceNode`/`iridescenceIORNode`/`iridescenceThicknessNode`, `clearcoatNode`/`clearcoatRoughnessNode`/`clearcoatNormalNode` (scalar/map analogues `transmission`, `iridescence`/`iridescenceIOR`/`iridescenceThicknessRange`, `clearcoat`/`clearcoatRoughness`/`clearcoatNormalMap` inherited from `MeshPhysicalMaterial`). These are the WebGPU node pipeline, not WebGL-only. Note: there is a `clearcoatNormalMap` scalar but no plain `clearcoatNormal` scalar — the node form is `clearcoatNormalNode`.

**5. Wind is a multi-layer vertex-stage TSL system, zero per-frame JS (verified 3-0).** Convincing vegetation wind = three combined frequency bands: global low-freq **sway** (whole field leans, height-masked so roots stay planted), mid-freq rolling **gust** fronts (a panning noise sampled by world position so a visible front crosses the field), and high-freq per-instance **turbulence** (flutter seeded by instance id). "Wind is not a single sine wave — it's three layered frequencies." Implement in the vertex stage via TSL wind nodes added to `positionNode`; `time` and `positionWorld` are GPU nodes, so it costs nothing on the JS side. This is the canonical Crysis main-bending + detail-bending model and generalizes to flags, cloth, banners, hanging signs. Sources: [procedural-grass-threejs](https://github.com/CK42BB/procedural-grass-threejs), [NVIDIA GPU Gems 3 Ch.16](https://developer.nvidia.com/gpugems/gpugems3/part-iii-rendering/chapter-16-vegetation-procedural-animation-and-shading-crysis), [SpeedTree wind overview](https://docs9.speedtree.com/sdk/doku.php?id=wind-overview).

### Support techniques (AA, post, WebGPU pipeline)

**6. On WebGPU, post-processing is the native node graph — NOT @react-three/postprocessing (verified 3-0).** Build the post chain with three's node graph: `RenderPipeline` (the current class; `PostProcessing` was **renamed to RenderPipeline in r183** (PR #32789) and kept only as a deprecated back-compat alias with the same `outputNode`/`render()` API) + TSL `pass()` from `three/tsl` + effect nodes from `three/addons/tsl/display/*` (`BloomNode`/`bloom`, `GTAONode`/`ao`, `SMAANode`/`smaa`, `DepthOfFieldNode`/`dof`, `TRAANode`, etc.). `@react-three/postprocessing` is the WebGL EffectComposer and fights WebGPU. R3F v9 just renders the three object graph, so no R3F-specific wrapper is needed. Sources: [ektogamat r3f-webgpu-starter](https://github.com/ektogamat/r3f-webgpu-starter) (pinned three 0.177 / R3F v8 — pattern valid, verify exact 0.184 import paths), [Complete Guide to Three.js Post-Processing 2026](https://threejsroadmap.com/blog/the-complete-guide-to-threejs-post-processing-in-2026).
> ✅ **Fact-check confirmed for 0.184:** the TSL AO node is **GTAO only** (`ao` from `three/addons/tsl/display/GTAONode.js`) — there is no WebGPU/TSL "HBAO" node (HBAO is a legacy WebGL example). GTAO writes a single-channel (red) result — compose multiplicatively (`color.mul(vec3(ao.r))`) or the scene turns red — and needs MRT view-space normals (`scenePass.setMRT(mrt({ output, normal: normalView }))`).

**7. Canvas MSAA, antialias flags, and depth-based AO interact — but the WebGPU rule is the OPPOSITE of the legacy one.** On legacy `WebGLRenderer` + EffectComposer, canvas `antialias` does nothing in a post pipeline (geometry goes to an off-screen target; the final composite is one fullscreen triangle), and MSAA conflicts with depth-based effects like SSAO/GTAO producing edge artifacts. Sources: [pmndrs/postprocessing Antialiasing wiki](https://github.com/pmndrs/postprocessing/wiki/Antialiasing).
> ⚠️ **Corrected (fact-check) for the native WebGPU node pipeline:** do **NOT** blindly force `antialias = false`. WebGPURenderer wires `antialias: true` to `renderer.samples = 4`, and `PassNode`'s off-screen render targets honor that sample count — so MSAA **does** multisample the off-screen scene pass (per maintainer Mugen87 / PR #28784). Choose MSAA (via `samples`) vs. a shader AA pass (SMAA/TRAA/FXAA) on perf/quality grounds, not on a belief that canvas MSAA is ignored. The MSAA-vs-depth-AO artifact caveat still applies — pairing GTAO with temporal AA is the safe combo. On the WebGL2 fallback backend, MSAA-with-PassNode was unsupported until ~r178, so a post-pass AA may still be needed there.

### Libraries / assets

**8. CC0 sourcing is real and shippable; downloads are PNG so KTX2 is an in-pipeline step (verified 3-0; one split 2-1).** Quality CC0, commercial, no-attribution sources: **3DTexel** leaf atlases (Albedo + Normal + Opacity — actually a fuller PBR set incl. Height/Roughness — at 4K/2K, **PNG** download), **ambientCG** (LeafSet004 and other Foliage/PBR sets, CC0), **Poly Haven** (CC0 photogrammetry plants/rocks + HDRIs, glTF up to 8K). Avoid **Quaternius Stylized Nature MegaKit** for photoreal (Ghibli-style low-poly — fine only for stylized/prototyping). The atlases are 2D textures, not pre-built hedge/cross-quad geometry — author the cards yourself; no verified CC0 pre-built photoreal hedge exists. Because downloads are PNG, apply KTX2/Basis encoding in your own pipeline (UASTC to preserve normal/alpha edges, ETC1S for albedo). Sources: [3DTexel atlases](https://3dtexel.com/atlases/), [ambientCG LeafSet004](https://ambientcg.com/view?id=LeafSet004), [Poly Haven plants](https://polyhaven.com/models/plants) / [license](https://polyhaven.com/license), [Quaternius](https://quaternius.com/packs/stylizednaturemegakit.html). Build-time encode: gltf-transform / gltfpack (confirmed it emits ETC1S + UASTC per-texture AND Draco/meshopt geometry in one scripted pipeline; KTX2 via the CLI `toktx()` transform, needs the external KTX-Software binary).

### Reference

**9. The gold-standard concrete reference is Bruno Simon's portfolio (verified 3-0).** Awwwards SOTD / FWA, relaunched late 2025. Grass = ~78,400 single-triangle blades, looped seamlessly toward the sides so the ground always reads as fully covered from the camera. Trees = standard-geometry trunks + **camera-facing planes (billboards)** for foliage, leaves rendered via an **SDF texture** for crisp alpha. Heavy instancing of trees/foliage/props; KTX2 (ETC1S + UASTC) + Draco compression; TSL shaders so it auto-runs on WebGPU. Proves AAA-feel is reachable with billboards + instancing + compression, not photogrammetry. **Caveat:** single-triangle blades are Bruno's low-cost choice — high-fidelity grass (Ghost of Tsushima, Codrops *Fluffiest Grass*) uses 7–15-vertex tapered Bézier-curve blades. Source: [Bruno Simon case study](https://www.awwwards.com/brunos-portfolio-case-study.html).

---

## Cross-cutting principles

These generalize beyond foliage to ANY realistic web environment (ground, rock, architecture, props, water, crowds):

1. **Believability is layered cheap tricks, not simulation scale.** Billboards/cards over solid geometry, baked/accumulated shadows over real-time GI, IBL over path tracing, impostors over distant geometry. Spend the budget where the eye looks.
2. **One node material, two backends.** Author every material once in TSL (`colorNode`/`normalNode`/`roughnessNode`/`positionNode`); it compiles to WGSL (WebGPU) and GLSL (WebGL2). Branch only on `renderer.isWebGPURenderer` for compute-fed inputs. Never maintain parallel GLSL.
3. **Anti-tiling is the #1 "fake" tell.** On any tiled ground/wall/rock, use a triplanar TSL helper (project `positionWorld` on X/Y/Z, blend by `abs(normalWorld).pow(sharpness)`, optionally blend two world scales). Biggest single realism win on tiled surfaces.
4. **PBR is dead without IBL.** A PBR material with no environment to reflect looks like plastic. Always set `scene.environment` (drei `<Environment>`, self-hosted HDRI) + one key sun before judging any material.
5. **Tonemapping is a deliberate decision, not a default.** Set `renderer.toneMapping` explicitly — **AgX** (`THREE.AgXToneMapping`) is the 2025–26 preference for natural highlight roll-off and saturated greens; ACESFilmic is the punchier safe alternative. Expose `toneMappingExposure` as an authored knob. (Both exist on WebGPURenderer in 0.184; exposure is honored by the WebGPU/TSL tone-mapping nodes.)
6. **Triangle/vertex budget is the real ceiling, not draw calls.** ~1.5–3M on-screen tris desktop, ~500K mobile; dpr cap 2. Draw-call counting catches naive scenes but misses the geometry-budget regression that LOD/impostors/chunking exist to prevent.
7. **Degrade by tier, everywhere.** Particle counts, physics body counts, wind octaves, shadow-map size, post passes, instance counts — all gated by a quality tier; low/mobile drops to InstancedMesh + impostors + lower counts + tonemap-only.
8. **`prefers-reduced-motion` is a first-class low-cost path.** Wind amplitude → 0, particles paused/hidden, physics → static rest pose, gestures inert, scrubbing stops but content stays. It is both an a11y requirement and the cheapest quality tier.
9. **One owner per property, one RAF loop.** Every per-frame value passes through exactly one owner and one `MathUtils.damp` (framerate-independent). Lenis(`autoRaf:false`) → `gsap.ticker` is the single RAF; rapier is the SOLE owner of any body transform (never also damp it in `useFrame`); a gesture produces a damped value exactly one consumer writes.
10. **A green build is not proof — verify in a real browser.** WebGPU/TSL/compute/hit-test bugs pass `tsc`/`vite build` and only reveal themselves on screen (GTAO-red, blank canvas, `<Html>` click-through, alphaHash shimmer, drei `useKTX2` crash). Screenshot the scene moving + read the console before "done."
11. **Self-host everything (GDPR, no CDN).** HDRIs, fonts, KTX2/Draco transcoders served from `/public`; never hot-link a CDN at runtime.
12. **The honest-ceiling clause.** When the brief needs pixel-faithful realism the browser can't reach, the answer is a baked render / video backdrop with interactive 3D as a secondary layer — not heroics in the shader.

---

## Reference benchmarks

| Reference | Technique it proves | Web-reachable? | URL |
|---|---|---|---|
| **Bruno Simon portfolio** | All-round web ceiling: ~78,400 single-tri instanced blades looped seamlessly; camera-facing SDF leaf billboards; standard-geometry trunks; heavy instancing; KTX2 (ETC1S+UASTC) + Draco; TSL → auto-WebGPU | Yes | [awwwards.com](https://www.awwwards.com/brunos-portfolio-case-study.html) |
| **False Earth (Codrops, Apr 2026)** | AAA-grass ceiling: WebGPU storage buffers + compute + **indirect drawing**; GPU-driven culling drops ~80% of instances before vertex work; cubic-Bézier blades with dual-frequency wind; 3-tier segment LOD (15/5/2) with distance jitter to hide pops | Partial — needs compute, not classic meshes | [tympanus.net/codrops](https://tympanus.net/codrops/2026/04/21/false-earth-from-webgl-limits-to-a-webgpu-driven-world/) |
| **Botanics (Sujen Phea)** | GPU-driven plant detail: 15,000 instanced blades under a GPU fluid sim + volumetric ray-marched spotlights + 500 GPU-computed particles + procedural flowers | Yes | [webgpu.com](https://www.webgpu.com/showcase/botanics-sujen-phea-threejs/) |
| **Jordan Breton island** | Credible full vegetation (grass/trees/wind/fire/waterfall/butterflies) using **fixed camera points** to control per-view quality (FWA SOTD Oct 2025) | Yes | [creativedevjobs.com roster](https://www.creativedevjobs.com/blog/best-threejs-portfolio-examples-2025) |
| **Codrops "Fluffiest Grass"** | Reproducible instanced-blade + alpha + wind + chunking workflow; 1M grass instances; ~7-vertex tapered blades | Yes | [tympanus.net/codrops](https://tympanus.net/codrops/2025/02/04/how-to-make-the-fluffiest-grass-with-three-js/) |
| **Codrops "Fractals to Forests"** | L-system/fractal branch structure + alpha-tested leaf cards for the canopy (hedge/tree skeleton + instanced leaf clusters) | Yes | [tympanus.net/codrops](https://tympanus.net/codrops/2025/01/27/fractals-to-forests-creating-realistic-3d-trees-with-three-js/) |
| **InstaLOD foliage impostors** | Billboard / octahedral impostors as the far LOD (1–2 quads preserving depth/volume from a baked angle atlas) for large maze/forest scenes | Partial — likely an offline bake step | [instalod.com](https://instalod.com/2025/04/07/optimizing-foliage-at-scale-imposters-with-instalod/) |

> **Where to keep looking:** awwwards.com/websites/3d, FWA, Codrops, the creativedevjobs best-three.js roster. Refresh periodically as the galleries rotate.

**Per-project realism-bar protocol:** at brief time pick ONE primary reference + a target tier — *Stylized* / *Believable-web* (Bruno-Simon level, the default) / *Photoreal-hero* (video or baked-render backdrop + interactive 3D secondary). Record the reference URL, tier, and the 3–4 specific tells to match (foliage density, key-light direction, palette, tonemapper) in `ARCHITECTURE.md`. A/B against the reference: extract a reference still (`ffmpeg -ss T -i ref.mp4 -frames:v 1 ref.jpg`), capture a matched-camera build screenshot at high tier, score side-by-side on the perceptual checklist (triplanar present, IBL + deliberate tonemapper, GTAO contact shadows composed correctly, thin-alpha edges resolved by TAA, backlit transmission, multi-layer wind, organic silhouette break) + the perf gate. Make "realistic" a pass/fail gate, not a vibe.

---

## Refuted / do-NOT-use

| Item | Verdict | Use instead |
|---|---|---|
| **mattdesl SSS shader-chunk gist** (inject translucency into `MeshStandardMaterial`) | **refuted 0-3** | `MeshPhysicalNodeMaterial.transmission` / a dedicated SSS node |
| **drei `<Instances>`/`<Instance>` for dense foliage (100k+)** | **refuted 1-2** — declarative wrapper carries real per-instance CPU overhead; drei's OWN docs say use `THREE.InstancedMesh` "for cases like foliage where you want no CPU overhead with thousands of instances" | native `THREE.InstancedMesh` (or `BatchedMesh` for mixed geometry). drei `<Instances>` only for small declarative sets (<~1–2k) |
| **@react-three/postprocessing (pmndrs EffectComposer)** on WebGPU | refuted 3-0 for WebGPU — WebGL EffectComposer fights the node pipeline | three's native `RenderPipeline` + TSL `three/addons/tsl/display/*`. EffectComposer only on an explicit WebGL2-only build |
| **0beqz/realism-effects (SSGI/TRAA/Motion Blur)** on WebGPU | avoid — WebGL2-legacy (built on pmndrs postprocessing), PerspectiveCamera-only; does NOT integrate with the WebGPU/TSL pipeline | native node `smaa()`/TAA; for "bounce" use IBL + baked AO. SSGI is unavailable on the WebGPU-first stack |
| **framer-motion-3d** | banned kit-wide — discontinued, breaks on React 19 | animate 3D via `useFrame` / TSL / GSAP / rapier; Motion stays DOM-only |
| **@react-three/lamina** | avoid — WebGL/GLSL-era, unmaintained for the WebGPU stack | compose material layers in TSL nodes |
| **drei `useKTX2` "crashes because it reads `renderer.extensions.has`"** | **refuted (false dichotomy)** — drei `useKTX2` wraps three's KTX2Loader and calls `detectSupport(gl)`; on a WebGPURenderer three's `detectSupport` takes the `isWebGPURenderer`/`hasFeature` branch. Real friction is the ordinary "init the renderer first" constraint (`await renderer.init()`) + drei multi-loader/disposal quirks, not a hard-coded crash. Note: drei master imports KTX2Loader from `three-stdlib`, whose `detectSupport` IS WebGL-only and throws on WebGPU — so prefer three's own loader to be safe | three's own `three/examples/jsm/loaders/KTX2Loader` + `detectSupport(gl)` after `renderer.init()`; self-host the Basis transcoder in `/public/basis/` |
| **Quaternius Stylized Nature MegaKit** for photoreal | wrong aesthetic (Ghibli low-poly) | CC0 photoreal atlases (3DTexel/ambientCG/Poly Haven) |
| **"False Earth proves AAA web grass REQUIRES compute, not InstancedMesh"** | **refuted** — the article never says compute is required; classic chunked InstancedMesh still renders ~1M+ blades in WebGL. Compute + indirect draw raise the ceiling and offload the CPU but do not make InstancedMesh obsolete | InstancedMesh for the baseline; WebGPU compute/indirect as the high-tier showcase |
| **`BatchedMesh.setGeometryIdForInstance` for per-object LOD on WebGPU** | **refuted** — method doesn't exist (it's `setGeometryIdAt`, not an LOD feature); core BatchedMesh has no native geometry LOD; the LOD extension is WebGL-only | drei `<Detailed>` for hero objects; distance impostors / geometry swap for fields |
| **Forcing `antialias = false` once any post is active** (WebGPU) | **refuted for the native node pipeline** — WebGPURenderer maps `antialias:true` → `samples=4` and PassNode honors it | choose MSAA (`samples`) vs shader AA on perf grounds; pair GTAO with temporal AA |

---

## Open questions (research frontier)

Consolidated across all briefs — the R&D backlog the roadmap draws from.

**Geometry & instancing**
- BatchedMesh vs multiple InstancedMesh for heterogeneous leaf cards/props in 0.184 — real-world frame time + memory under WebGPURenderer + TSL? (needs a benchmark)
- Exact 0.184 WebGPU indirect-draw wiring (`IndirectStorageBufferAttribute` + `geometry.setIndirect()` → `drawIndirect`; **fact-check confirmed these symbols exist, WebGPU-only, landed ~r174**) — how to cleanly feed a TSL compute culling pass into an InstancedMesh/BatchedMesh draw from R3F.
- Octahedral-impostor baking on the web: maintained 0.184/WebGPU baker, or must the angle atlas be baked offline (Blender/InstaLOD) and shipped as a KTX2 atlas?
- Per-object LOD pop-hiding without TAA: distance jitter vs cross-fade dithering vs screen-space-error — which reads best on the WebGL2 fallback?
- Cheap on-screen triangle estimation (post-cull) for the perf auditor to enforce the budget automatically — `renderer.info` runtime read vs static estimate?

**Materials & shading**
- alphaHash+TAA vs alphaToCoverage(+MSAA) on WebGPU for overlapping thin edges — which is cleaner? (empirical A/B; worse under motion for animated cards)
- Exact 0.184 TSL transmission/SSS node inputs (`thicknessNode`, attenuation) and whether `MeshSSSNodeMaterial` ships under that name — verify in node_modules.
- Does WebGPU `transmission` need a transmission render target / extra pass, and its cost on mid-tier mobile? (may force gating to a high tier)
- Triplanar in TSL: best blend-sharpness + two-scale defaults; is per-fragment 3× sampling acceptable on mobile or drop to biplanar/2-tap on low tier?
- KTX2 color management: albedo decoded sRGB, normal/roughness linear through the `texture()` node + AgX/ACES output-transform interaction.

**Lighting, IBL & shadows**
- AgX vs ACES as the house default — side-by-side on 0.184 WebGPURenderer to confirm AgX's saturated-greens/highlight roll-off.
- Do drei `<AccumulativeShadows>`/`<RandomizedLight>`/`<ContactShadows>` render correctly under WebGPURenderer in drei 10.7? (render-target/depth edge cases — runtime smoke test, not a build pass)
- A single PCFSoftShadowMap sun shadow worth the cost on mobile/low tier, or fall back to ContactShadows only?
- Is KTX2/Basis even applicable to HDR env maps, or is `.hdr`/EXR self-hosting the only realistic IBL route on WebGPU?

**Post-processing & color**
- ACES vs AgX as the kit default for general (non-foliage) brand sites; ship a per-site toggle rather than a hard default?
- Does a first-class TRAA/TAA node ship under `three/addons/tsl/display/` in 0.184 (TRAANode is present per fact-check), and is the DoF node signature stable?
- DoF on a mobile-first scroll site — worth the cost, or reserve for hero/cinematic moments only?
- Color grading: hand-rolled TSL lift/gamma/gain vs a 3D LUT (.cube via `Lut3DNode`) sampled in TSL — better authored-look workflow for non-technical brand tuning?

**Animation, physics & "alive"**
- Exact 0.184 compute-particle surface (**fact-check confirmed:** `instancedArray()` + `Fn()` + `renderer.compute()`/`computeAsync()` + `positionNode = buffer.toAttribute()`; r184 example uses sync `compute()`) — pin against installed build.
- WebGL2 fallback policy for compute particles — smaller CPU/`useFrame` buffer, transform-feedback, or static field?
- Reduced-motion semantics for physics — freeze at rest pose, disable sim, or run-but-ignore impulses? (kit-wide decision)
- Concrete per-tier budgets (active rigid bodies, particle count, wind octaves) on a throttled mid-tier mobile profile — needs measurement.
- ecctrl note (**fact-check correction**): ecctrl is a **floating-capsule dynamic-RigidBody** controller (spring + damping + ground shapecast), **NOT** built on Rapier's KinematicCharacterController; compatible with @react-three/rapier ≥2.2 / R3F ≥9.4 / React ≥19.2 / three ≥0.184. pmndrs also ships physics-free `BVHEcctrl` as an alternative. **@react-three/rapier is NOT in the kit's package.json today** — must be installed per-brief.

**Performance, fallback, tooling & realism measurement**
- WebGPU in headless CI: GitHub Actions runners are GPU-less (SwiftShader) — does a Playwright smoke test exercise real WebGPU or only WebGL2 fallback? (may need split CI gates)
- Screenshot-diff stability for animated/noise/alphaHash scenes — determinism strategy (freeze time/seed, reduced-motion path, perceptual threshold)?
- Recipe granularity vs one-loop/one-owner rules — a shared loop/context contract so composed modules don't each spin a RAF or own the camera.
- Should a tiny GPU micro-benchmark at startup set the initial quality tier instead of the unreliable `navigator.deviceMemory` heuristic (undefined on Safari/iOS/Firefox)?
- Perceptual realism scoring scale — binary pass/fail per tell vs 1–5 — for repeatability across agents/sessions; and can any A/B step be reliably automated, or is human-in-the-loop the only sound gate?
- Photoreal-hero production recipe: seam/color/tonemap parity between a baked-render/video plate and the live interactive layer.

---

## Sources

**Reference benchmarks (gold-standard sites/demos)**
- Bruno Simon portfolio case study — https://www.awwwards.com/brunos-portfolio-case-study.html
- False Earth (Codrops, WebGPU-driven grass) — https://tympanus.net/codrops/2026/04/21/false-earth-from-webgl-limits-to-a-webgpu-driven-world/
- Botanics (Sujen Phea, WebGPU showcase) — https://www.webgpu.com/showcase/botanics-sujen-phea-threejs/
- Best Three.js portfolios 2026 (Jordan Breton roster) — https://www.creativedevjobs.com/blog/best-threejs-portfolio-examples-2025
- Codrops "Fluffiest Grass" — https://tympanus.net/codrops/2025/02/04/how-to-make-the-fluffiest-grass-with-three-js/
- Codrops "Fractals to Forests" (trees) — https://tympanus.net/codrops/2025/01/27/fractals-to-forests-creating-realistic-3d-trees-with-three-js/

**Geometry, instancing & LOD**
- R3F scaling-performance — https://r3f.docs.pmnd.rs/advanced/scaling-performance
- drei Instances — https://drei.docs.pmnd.rs/performances/instances
- InstancedMesh vs BatchedMesh forum — https://discourse.threejs.org/t/how-to-choose-between-instancedmesh-and-batchedmesh/81221
- grass-shader-glsl (400k+ blades) — https://github.com/Nitash-Biswas/grass-shader-glsl
- Codrops Three.js Instances tutorial — https://tympanus.net/codrops/2025/07/10/three-js-instances-rendering-multiple-objects-simultaneously/
- Codrops BatchedMesh + WebGPURenderer — https://tympanus.net/codrops/2024/10/30/interactive-3d-with-three-js-batchedmesh-and-webgpurenderer/
- InstaLOD foliage impostors — https://instalod.com/2025/04/07/optimizing-foliage-at-scale-imposters-with-instalod/

**Materials, alpha & translucency**
- Official webgl_materials_alphahash example — https://threejs.org/examples/webgl_materials_alphahash.html
- Material.alphaHash docs — https://threejs.org/docs/#api/en/materials/Material.alphaHash
- alpha-test vs alpha-hash forum — https://discourse.threejs.org/t/alpha-test-vs-alpha-hash/44493
- 80.lv — Creating Vegetation with Alpha Cards — https://80.lv/articles/human-emotions-creating-vegetation-with-alpha-cards
- mattdesl SSS gist (REFUTED — do not use) — https://gist.github.com/mattdesl/2ee82157a86962347dedb6572142df7c
- procedural-grass-threejs (SSS/wind, GLSL+WGSL+TSL) — https://github.com/CK42BB/procedural-grass-threejs
- Maxime Heckel — Field Guide to TSL and WebGPU — https://blog.maximeheckel.com/posts/field-guide-to-tsl-and-webgpu/
- NVIDIA GPU Gems 3 Ch.16 (Crysis vegetation) — https://developer.nvidia.com/gpugems/gpugems3/part-iii-rendering/chapter-16-vegetation-procedural-animation-and-shading-crysis
- SpeedTree wind overview — https://docs9.speedtree.com/sdk/doku.php?id=wind-overview

**Foliage geometry workflow (game-art)**
- Polycount foliage wiki — https://wiki.polycount.com/wiki/Foliage
- Polycount: foliage alphas vs geometry — https://polycount.com/discussion/144594/foliage-alphas-vs-geometry
- Polycount: polycount vs alpha cutout — https://polycount.com/discussion/204716/foliage-polycount-vs-alpha-cutout
- ArtStation: Quadmesh Billboard Foliage (Houdini → Unreal) — https://www.artstation.com/mohamad_salame1/blog/AyAL/quadmesh-billboard-foliage-houdini-to-unreal

**Post-processing, AA & color**
- Complete Guide to Three.js Post-Processing 2026 — https://threejsroadmap.com/blog/the-complete-guide-to-threejs-post-processing-in-2026
- ektogamat r3f-webgpu-starter — https://github.com/ektogamat/r3f-webgpu-starter
- pmndrs/postprocessing Antialiasing wiki — https://github.com/pmndrs/postprocessing/wiki/Antialiasing
- 0beqz/realism-effects (WebGL2-legacy; avoid on WebGPU) — https://github.com/0beqz/realism-effects
- AgX vs ACES tonemapping forum — https://discourse.threejs.org/t/is-agx-tonemapping-implemented-correctly/60609

**CC0 assets & pipeline**
- Poly Haven plants — https://polyhaven.com/models/plants
- Poly Haven license / glTF→KTX2 workflow — https://polyhaven.com/license
- ambientCG LeafSet004 — https://ambientcg.com/view?id=LeafSet004
- 3DTexel atlases — https://3dtexel.com/atlases/
- Quaternius Stylized Nature MegaKit (avoid for photoreal) — https://quaternius.com/packs/stylizednaturemegakit.html
- Sketchfab boxwood/hedge sets (mostly commercial — filter CC0/CC-BY) — https://sketchfab.com/3d-models/boxwood-hedge-set-version-1-f92da3e79b004b8497bf93ec86319bfa

**Corpus (this dossier's provenance)**
- Source: the **"Production site audit"** session deep-research workflow `wf_4afd55ac` — 110 fan-out agents
  (decomposer + 6 web-searchers + ~25 source-extractors + 75 adversarial verifiers + synthesis), producing
  23 verified claims (2 refuted) → 9 synthesized findings over 33 deduplicated sources.
- Re-checked here by a second fact-check pass (10 capability-area briefs + 22 adversarial verifications)
  that corrected the BatchedMesh-LOD, antialias-off, useKTX2-crash-mechanism, and "compute-required" claims.

**Kit internal cross-references**
- [`realistic-foliage.md`](./realistic-foliage.md) — the foliage specialization this dossier generalizes
- [`realism-and-interactivity.md`](./realism-and-interactivity.md) — WebGPU/TSL gotchas (GTAO RedFormat, useKTX2, `<Html>` portal), verify loop
- [`performance-and-fallback.md`](./performance-and-fallback.md) — budgets, instancing-as-lever-1, perf rubric
- [`webgpu-tsl.md`](./webgpu-tsl.md) — TSL recipes, post chain
