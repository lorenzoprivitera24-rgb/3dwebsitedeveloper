# Web3D kit — development roadmap to excellence (2026→)

> This is an execution plan, not a survey. It takes the kit from a strong **scroll/pointer "morphing-form" starter** to a reusable **realistic-environment toolkit** — recipes and modules a build composes — without breaking the non-negotiables: **one RAF loop, one owner per property, no framer-motion-3d, mobile + a11y in the definition of "done," and verify-in-a-real-browser (a green build is not proof).**

---

## 1. North star & definition of excellent

**What we are building toward.** A toolkit that produces *believable, inhabited* 3D environments on the web — tiled ground that doesn't look tiled, PBR surfaces lit by real IBL, foliage that catches backlight and sways in layered wind, contact shadows that ground objects, a tasteful post chain, and overlay UI that stays fully usable. Everything tier-gated so it holds a 45fps floor on a mid-tier phone.

**The honest ceiling — say it out loud in every brief.** The bar is **"excellent WEB 3D"**: Bruno Simon's portfolio, Codrops *False Earth*, *Botanics* (Sujen Phea), Jordan Breton's island — top-Awwwards / FWA / Codrops tier. It is **NOT** UE5 Nanite / GTA V / RDR2 engine tech. There is no in-browser virtualized geometry, no real-time path-traced GI, no virtual shadow maps. Practical budgets: **~1.5–3M on-screen triangles desktop / ~500K mobile, draw calls in the low hundreds, DPR cap 2.** For a *pixel-faithful* photoreal hero, the only honest answer is a **baked render or video backdrop** with interactive 3D as a secondary layer.

**The measurable bar.** "Realistic" must be a gate, not a vibe. A build is excellent when it passes **both**:

- **Perceptual realism checklist** (highest-yield "fake" tells, in order): anti-tiling/triplanar on tiled surfaces · IBL + deliberate tonemapper (AgX default, ACES alt) · GTAO contact occlusion composed correctly · thin-alpha edges resolved by SMAA/TAA not raw MSAA · back-lit transmission on vegetation/glass · multi-layer wind (not a single sine) · organic silhouette (no boxy meshes) · grounded by a contact/accumulated shadow.
- **Perf budget**: desktop <150 draw calls / <1.5M tris / 60fps; mobile <80 / <500K / 45fps floor; frame <16.6ms desktop / <22ms mobile; ≤1 shadow-casting light.

Both are scored against **one chosen reference** per project (recorded in `ARCHITECTURE.md` as the "Realism bar") via an A/B-against-reference capture. See §5 area 10.

---

## 2. Where we are

| # | Area | Status | One-line reality |
|---|------|--------|------------------|
| 1 | Geometry & instancing | **Missing (general) / Have (foliage docs)** | Single icosahedron mesh; zero instancing code; foliage instancing well-documented but uncoded. |
| 2 | Materials & shading (PBR + TSL) | **Missing** | One untextured `MeshStandardNodeMaterial`; no maps, no triplanar, no transmission, no KTX2 wired. |
| 3 | Lighting, IBL & shadows | **Missing** | 3 analytic lights, no IBL, no shadows, no tonemapping set — scenes render flat. |
| 4 | Post-processing & color | **Missing + contradictory** | No post chain; `antialias:true` hardcoded; SKILL.md still recommends the avoided WebGL path. |
| 5 | Asset pipeline & sourcing | **Missing** | No `public/`, no loaders, no transcoder, no encode script; pipeline exists only as prose. |
| 6 | Animation, wind, physics & "alive" | **Partial (discipline) / Missing (limbs)** | One-RAF/one-owner law is solid; wind, compute particles, gestures, physics all absent (rapier not even a dep). |
| 7 | Performance, fallback & mobile | **Partial** | Tier hook + reduced-motion + 3-level fallback exist; static tier, no profiling tooling, no adaptive layer. |
| 8 | Reference benchmarks & measuring "real" | **Missing** | Only Bruno Simon named; no roster, no realism rubric, no A/B workflow. |
| 9 | Interactivity & DOM/overlay | **Partial + 1 hazard** | Single-loop wiring correct; React Bits vendored-not-integrated; `ScrollReveal` kills ALL ScrollTriggers on unmount. |
| 10 | Tooling, verification & agents | **Partial + broken CI** | 6 agents + auto-dispatch + skill playbook are strong; CI runs webpack on a Vite project; no browser-verify gate; agent-memory dir absent. |

---

## 3. Strategy — the sequencing logic

Build the **foundations that unblock everything else first**, then the **disciplines**, then **polish**, then the **meta-layer** that keeps it honest.

1. **Foundations (everything composes on these).**
   - **Asset/KTX2 pipeline + loaders** — nothing realistic ships uncompressed; every later step consumes maps.
   - **PBR + IBL baseline** — PBR without IBL looks dead; IBL is the single biggest realism jump and a prerequisite for judging any material.
   - **Post-FX node graph + AgX tonemapping** — resolve the SKILL.md contradiction, flip the `antialias` default, wire RenderPipeline. Output looks flat until this exists.
   - **Instancing core** — the one scalability lever; pre-build it before the kit grows past one mesh.
2. **Disciplines (the "looks alive" layer).** Foliage (instanced cards + alphaHash + transmission) → multi-layer TSL wind → compute particles → physics + gestures. Each rides the one-RAF/one-owner law.
3. **Polish (premium cues, gated high).** GTAO/AO in post, bloom, DoF for hero shots, iridescence/clearcoat, color grading, impostors/chunking for large scenes, SSGI honesty note.
4. **Meta-layer (keeps excellence repeatable).** `recipes/` toolkit, the realism rubric + reference roster, real CI + Playwright browser-smoke gate, agent-memory accrual, dependency cadence.

**Hard gate between phases:** commit between phases (parallel agents + `git stash` destroy tracked edits), and **verify each new module in a real browser preview** — WebGPU/TSL bugs pass `tsc`/`vite build` and only break on screen.

---

## 4. Roadmap — 4 horizons

Each line: `[area] (effort · impact)`. Effort S/M/L from the briefs.

### NOW (0–2 weeks) — unblock + fix what's broken

- [ ] **Resolve the post-FX contradiction**: stop recommending `@react-three/postprocessing`/drei EffectComposer on WebGPU in SKILL.md + webgpu-tsl.md; point to RenderPipeline + native node graph. `[post] (S · high)`
- [ ] **Wire KTX2-on-WebGPU loader + IBL**: `src/lib/ktx2.ts` using **three's own `KTX2Loader`** via `useLoader`, self-host `/public/basis/`, add drei `<Environment>` self-hosted HDRI to `Scene.tsx`. `[materials/lighting/assets] (M · high)`
   - *Correction baked in:* drei `useKTX2` is a thin wrapper over three's loader and calls `detectSupport(gl)`; the real constraint is **call it after `await renderer.init()`** (deprecated `detectSupportAsync`), not a mythical `extensions.has` crash. Prefer three's loader for control, but the "crash" framing in the docs must be rewritten.
- [ ] **Set tonemapping + exposure**: `gl.toneMapping = THREE.AgXToneMapping` (ACES as documented alt), expose `toneMappingExposure`. Both confirmed selectable on WebGPURenderer 0.184. `[lighting/post] (S · high)`
- [ ] **Flip the AA default**: do **not** hardcode `antialias:false`. *Correction:* WebGPURenderer wires `antialias:true → samples=4` and PassNode honors it, so MSAA **does** apply to the off-screen scene pass. Choose MSAA-via-samples vs SMAA/TRAA on perf/quality grounds, documented. `[post/perf] (S · high)`
- [ ] **Self-hosted HDRI convention**: `/public/hdri/`, commit a 1–2k CC0 Poly Haven `.hdr`, document `<Lightformer>` studio alt. `[lighting/assets] (S · high)`
- [ ] **Install profiling**: add `r3f-perf` (dev), mount `<Perf/>` behind `import.meta.env.DEV`. Makes the auditor's rubric runnable. `[perf] (S · high)`
- [ ] **Replace broken CI**: delete `webpack.yml`; add `ci.yml` (Node 20/22, `npm ci`, `tsc -b && vite build`, lint). Add ESLint flat config with `@react-three/eslint-plugin` + `react-hooks`. `[tooling] (S · high)`
- [ ] **Kill the ScrollReveal hazard**: add a Lenis↔ScrollTrigger `scrollerProxy` bridge in `SmoothScroll.tsx`; document the rule that copied React Bits scroll components must NOT call `ScrollTrigger.getAll().forEach(t=>t.kill())` (it destroys the kit's own driver) and must use the Lenis scroller. `[interactivity] (M · high)`
- [ ] **Robust quality tier**: convert `useMemo([])` to state recomputed on debounced resize/orientation; stop trusting `deviceMemory` alone (undefined on Safari/iOS → fall back to viewport + `pointer:coarse` + `hardwareConcurrency`); add `postLevel`/`particleCount`/`physicsEnabled`/`windOctaves`/`shadowMapSize` fields. `[perf/animation] (S · high)`

### NEXT (1–2 months) — the realistic-environment disciplines

- [ ] **General Geometry & Instancing reference** + decision rubric (InstancedMesh default · drei `<Instances>` only <~1–2k · `BatchedMesh` for many distinct geos under one material · merge only static). `[geometry] (M · high)`
   - *Correction baked in:* core `BatchedMesh` (r184) supports per-instance frustum culling via **`perObjectFrustumCulled`** (boolean) under WebGPU+TSL, and geometry reassignment via **`setGeometryIdAt(instanceId, geometryId)`** — **`setGeometryIdForInstance` does not exist, and core BatchedMesh has NO native per-object geometry LOD.** For per-object LOD use drei `<Detailed>` (THREE.LOD) for hero objects; for instanced-field LOD use distance-swapped impostors / the third-party `@three.ez` extension (WebGL-only today) — do **not** schedule "BatchedMesh native LOD."
- [ ] **Ship `InstancedField.tsx`**: native `THREE.InstancedMesh` scatter + per-instance attributes (hash/wind-phase/color), TSL node material, tier-gated count, paired with a drei `<Detailed>` hero. The "instancing exists in code" proof. `[geometry] (M · high)`
- [ ] **PBR + triplanar material primitive** `materials/pbrTriplanar.ts` (KTX2 maps → colorNode/normalNode/roughnessNode; `triplanar(map,scale,sharpness)` blending `abs(normalWorld)`). The #1 anti-tiling win. `[materials] (M · high)`
- [ ] **Alpha-edge recipe** `materials/alphaModes.ts` (alphaHash: `transparent=false`,`depthWrite=true`, needs TAA — confirmed vs the official example; alphaToCoverage needs MSAA; alphaTest for cutouts). `[materials] (S · high)`
- [ ] **Two-sided transmission/SSS** `materials/translucent.ts` via `MeshPhysicalNodeMaterial` (`transmission`/`thickness`/`ior`/`attenuation`). Confirmed working on WebGPU 0.184. **Not** the refuted mattdesl SSS gist. `[materials] (M · high)`
- [ ] **Reusable PostFX module** `PostFX.tsx`: `RenderPipeline` + `pass` + MRT(`output`,`normalView`) → GTAO (`ao` node, RedFormat-safe `color.mul(vec3(ao.r))`) → bloom → SMAA → tonemap → grade. Tier-gated (full/medium/off). `[post] (L · high)`
- [ ] **Multi-layer TSL wind node** `tsl/wind.ts` (global sway masked by height + gust fronts + per-instance turbulence) + a `FoliageField.tsx` consumer. Makes the foliage doc's "concrete next step" runnable. `[animation/materials] (M · high)`
- [ ] **Grounding shadows** `Ground.tsx`: drei `<AccumulativeShadows>`+`<RandomizedLight>` (static hero) / `<ContactShadows>` (moving), one PCFSoft sun caster with tight frustum + normalBias, tier-gated resolution. Smoke-test under WebGPURenderer. `[lighting] (M · high)`
- [ ] **Asset-encode script** `scripts/encode-assets.mjs` (gltf-transform: dedup/weld/quantize/draco|meshopt + KTX2 ETC1S albedo / UASTC normals+alpha). Confirmed gltf-transform does both in one scripted pipeline (KTX2 via the CLI `toktx` transform; needs KTX-Software binary). `[assets] (M · high)`
- [ ] **Add `@react-three/rapier` (+ ecctrl)** to deps — confirmed **absent today** — and `PhysicsStage.tsx`: `<Physics>` stepped inside the R3F frame, 1–2 `<RigidBody>` heroes, optional character. Rapier is the **sole** owner of body transforms (never also damped). `[animation] (M · high)`
   - *Correction baked in:* ecctrl is a **floating-rigidbody** controller (spring + damping + shapecast), **not** rapier's `KinematicCharacterController`. Document it as one valid choice (BVHEcctrl is a physics-free alternative).
- [ ] **Make `@use-gesture/react` real**: one worked `useDrag`/`usePinch` → `MathUtils.damp` → single consumer (uniform or impulse). `[interactivity/animation] (S · medium)`
- [ ] **Reusable scroll/pointer hooks** `useScrollProgress`, `usePointerDamp`. `[interactivity] (M · high)`
- [ ] **Adaptive layer**: wrap scene in drei `<PerformanceMonitor onDecline>` + `<AdaptiveDpr pixelated>` + `<AdaptiveEvents>`. All confirmed in drei 10.7. `[perf] (M · high)`
- [ ] **WebGPU/WebGL2 feature-gate seam** `useRenderBackend()` reading `renderer.isWebGPURenderer`. *Note:* the flag stays `true` on WebGL2 fallback — for true backend detection read `renderer.backend.isWebGPUBackend`. `[perf] (S · medium)`
- [ ] **Playwright browser-smoke gate**: boot `vite preview`, assert renderer init / no console errors / baseline screenshot diff. The machine backing for "green build is not proof." `[tooling] (M · high)`
- [ ] **Expand perf-auditor rubric**: on-screen triangle budget, per-object LOD, impostor far-LOD, drei-`<Instances>`-for-dense-foliage = Critical, post tier-gated/off-on-low, antialias/AA story, GTAO RedFormat + MRT, double-owner (rapier + useFrame) check. `[perf/geometry/animation] (S · high)`

### LATER (this quarter) — polish, scale & the meta-layer

- [ ] **Iridescence + clearcoat showcase** `materials/coated.ts` (confirmed on WebGPU 0.184; node props are `iridescenceNode`/`clearcoatNode`/`clearcoatNormalNode`; scalar analogue of the normal is `clearcoatNormalMap`). `[materials] (S · medium)`
- [ ] **AO in post + bloom** finalize (`ao` from `three/addons/tsl/display/GTAONode.js`; **no WebGPU HBAO node exists** — GTAO only). `[lighting/post] (M · medium)`
- [ ] **Impostor / far-LOD recipe** (octahedral/billboard angle atlas as cheapest far LOD for trees/bushes; likely an offline bake shipped as a KTX2 atlas). `[geometry] (M · medium)`
- [ ] **Chunking/streaming guidance** for environments larger than one view (cell instancing, CPU frustum-cull cells, dispose by distance). `[geometry] (S · medium)`
- [ ] **WebGPU compute + indirect-draw grass showcase** `ComputeGrass.tsx`, gated behind `isWebGPURenderer` with InstancedMesh fallback. *Confirmed API:* TSL compute (`instancedArray` + `Fn` + `renderer.compute`/`computeAsync`) writes an **`IndirectStorageBufferAttribute`**, attached via **`geometry.setIndirect(...)`**, consumed by `drawIndirect`. WebGPU-only. **Honesty note:** classic chunked InstancedMesh already renders ~1M blades in WebGL2 — compute *raises* the ceiling and offloads the CPU, it does **not** make InstancedMesh obsolete. Showcase tier, not default. `[geometry/animation] (L · medium)`
- [ ] **Compute-particle module** `ComputeParticles.tsx` (`instancedArray` + compute `Fn` + `positionNode = buffer.toAttribute()`) with a maath WebGL2 fallback field. `[animation] (L · high)`
- [ ] **Color-grade node** (TSL saturation/contrast/white-balance, optional 3D LUT via `Lut3DNode`) after tonemap. `[post] (M · high)`
- [ ] **Accessible overlay kit**: `<Scrim>` (≥4.5:1 over busiest frame), skip-link/landmarks, ≥44px targets, `:focus-visible`, `AnimatePresence` sections, reduced-motion gate. `[interactivity] (L · high)`
- [ ] **Clickable drei `<Html>` portal primitive** `<OverlayLayer>` (fixed, `pointer-events:none`/children `auto`, `occlude`) + `elementFromPoint` verify step. `[interactivity] (S · medium)`
- [ ] **React Bits selection + tier-gate cheat-sheet** (grep-verified dep split: 29 gsap / 30 ogl / 23 three / 20 motion; gate ogl/three backgrounds + self-RAF cursors OFF on low/mobile; one animated bg at a time; never stack with the WebGPU canvas). `[interactivity] (S · medium)`
- [ ] **Reference-benchmark roster doc** (Bruno Simon · False Earth · Botanics · Jordan Breton, each tagged technique + web-reachability yes/partial/no). `[benchmarks] (M · high)`
- [ ] **Per-project realism-bar protocol** written into `ARCHITECTURE.md` (1 reference + tier Stylized/Believable/Photoreal-hero + 3–4 tells to match). `[benchmarks] (S · high)`
- [ ] **A/B-against-reference workflow** (ffmpeg extract → matched-camera screenshot → side-by-side → scored rubric). `[benchmarks] (M · high)`
- [ ] **Scored "is it real enough?" perceptual checklist** owned by an agent (realism gate mapping findings to the specialist who fixes each). `[benchmarks/tooling] (M · high)`
- [ ] **`recipes/` toolkit**: instanced-foliage · ktx2-triplanar-ground · ibl-environment · webgpu-post-stack — each browser-verified with a screenshot + README. `[tooling] (L · high)`
- [ ] **Wire agent-memory for all 6 agents** (create `.claude/agent-memory/`, add `memory: project` frontmatter, "consult-then-update" line). `[tooling] (S · medium)`
- [ ] **Dependency cadence** (dependabot/renovate grouped 3D cluster, gated by CI + smoke; quarterly STACK refresh checklist). `[tooling] (S · medium)`
- [ ] **CSM / `<CascadedShadows>`** — evaluate only for large outdoor scenes; default avoid (perf/complexity sink). `[lighting] (S · low)`
- [ ] **Real visual Poster** (build-time screenshot as the no-WebGL fallback, DOM layered over). `[perf] (M · medium)`

### R&D (frontier) — the open questions to settle empirically

> Schedule these as *benchmarks*, not features. Each needs a real-preview A/B before it becomes doctrine.

- **AA for thin moving alpha edges**: `alphaHash`+TAA vs `alphaToCoverage`+MSAA on WebGPU — does `smaa()` clean *wind-animated* leaf-card shimmer or is a custom TRAA node required? `[materials/post/animation]`
- **AgX vs ACES as house default**: side-by-side on 0.184 WebGPURenderer; decide default vs per-site toggle. `[lighting/post]`
- **Impostor baking on the web**: maintained R3F/three baker for 0.184/WebGPU, or offline (Blender/InstaLOD) → KTX2 atlas? Runtime helper vs pipeline step. `[geometry]`
- **On-screen triangle estimation** for the auditor: cheap post-cull estimate from Instanced/Batched counts vs `renderer.info` read. `[perf]`
- **WebGPU in headless CI**: GitHub runners are GPU-less (SwiftShader) → smoke test exercises mostly WebGL2 fallback. Split into fallback-CI gate + preview-MCP WebGPU gate on a GPU box. `[tooling]`
- **Screenshot-diff determinism** for noise/dither scenes (freeze time/seed or perceptual threshold). `[tooling]`
- **DoF on a mobile-first scroll site**: worth the cost, or hero-only? `[post]`
- **Reduced-motion semantics for physics**: freeze at rest / disable sim / run-but-ignore-impulses — pick one kit-wide. `[animation]`
- **Per-tier budgets** (active rigid bodies, particle count, wind octaves) measured on throttled mid-tier Android — the kit has never been profiled on a real device. `[perf/animation]`
- **WebGPU transmission cost**: does real-time refraction need an extra pass/target on mobile → gate to high tier? `[materials]`
- **KTX2 for HDR env maps** vs `.hdr`/EXR self-hosting on the WebGPU path. `[lighting/assets]`
- **Gaussian splatting** (`@mkkellogg/gaussian-splats-3d`) WebGPU/R3F-v9 status — primary path or WebGL2-fallback-only? `[assets]`
- **Dynamic vs static scrim** over a moving canvas (per-frame luminance sampling worth the budget?). `[interactivity]`
- **Per-component React Bits audit** (134 comps) for self-RAF / `getAll().kill()` / native-scroll → "safe-to-wire" vs "patch-first" table. `[interactivity]`
- **Recipe composition contract**: how modules share the one loop / one camera owner without each spinning a RAF — define in `ARCHITECTURE.md`. `[tooling]`
- **Agent memory scope**: per-project vs promoted to global `~/.claude`. `[tooling]`

---

## 5. Per-area deep dive

### 1. Geometry & instancing
**Current:** single `<icosahedronGeometry>`; foliage instancing well-documented (`realistic-foliage.md`) but zero general instancing code; auditor only counts draw calls/separate meshes.
**Target:** a decision rubric (InstancedMesh default · drei `<Instances>` only <~1–2k · BatchedMesh for many distinct geos under one material · merge only static) + per-object LOD + impostors + culling + chunking, all tier-driven, honest about the ~1.5–3M-tri ceiling.
**Steps:** general reference doc → `InstancedField.tsx` (+ drei `<Detailed>` hero) → impostor recipe → chunking guidance → compute/indirect grass showcase → expanded auditor.
**Touchpoints:** NEW `references/geometry-and-instancing.md`; NEW `src/canvas/InstancedField.tsx`/`ComputeGrass.tsx`/`Impostor.tsx`; `useQualityTier.ts`; `perf-fallback-auditor.md`.
**Verified corrections:** `perObjectFrustumCulled` (not `perObjectFrustumCulling`); `setGeometryIdAt` (not `setGeometryIdForInstance`); **no native BatchedMesh LOD** — use `<Detailed>`/impostors. Indirect draw = `IndirectStorageBufferAttribute` + `setIndirect()`, WebGPU-only. drei `<Instances>` CPU overhead for dense foliage = **confirmed**.

### 2. Materials & shading (PBR + TSL)
**Current:** one untextured `MeshStandardNodeMaterial`; no maps, triplanar, transmission, IBL, or KTX2 in `src/`; strong theory in two docs.
**Target:** a small renderer-agnostic TSL material library — PBR+triplanar, alpha modes, two-sided transmission/SSS, iridescence/clearcoat — fed KTX2 maps, lit by IBL.
**Steps:** KTX2 loader + IBL → `pbrTriplanar.ts` → `alphaModes.ts` → `translucent.ts` → `coated.ts` → materials reference + agent scope.
**Touchpoints:** NEW `src/lib/ktx2.ts`, `src/canvas/materials/*`, `references/materials-shading.md`; extend `tsl-shader-engineer.md`.
**Verified:** `MeshPhysicalNodeMaterial` transmission/iridescence/clearcoat all work on WebGPU 0.184. alphaHash opaque+TAA = confirmed. drei `useKTX2` "crash" framing is **wrong** (it wraps three's loader; real constraint = init order) — rewrite the doc. mattdesl SSS gist = **refuted**, use `transmission`.

### 3. Lighting, IBL & shadows
**Current:** 3 analytic lights, no IBL/shadows/tonemapping; docs already name the targets.
**Target:** IBL-first (one self-hosted HDRI via `<Environment>`) + one shadow-casting sun + AgX + exposure + accumulated/contact grounding + AO in post; honest SSGI/GI ceiling.
**Steps:** wire IBL+sun+AgX → self-hosted HDRI convention → grounding helper → lighting reference → architect-agent playbook → AO in post → SSGI/CSM honesty note.
**Touchpoints:** `Scene.tsx`, `Stage.tsx`, NEW `/public/hdri/`, `Ground.tsx`, `Post.tsx`, `references/lighting-ibl-shadows.md`, `r3f-scene-architect.md`.
**Verified:** AgX + ACES + `toneMappingExposure` all honored on WebGPURenderer 0.184. drei `<Environment>` `environmentIntensity`/`environmentRotation` confirmed under R3F 9.6. SSGI (0beqz) is WebGL2-legacy — **unavailable** on WebGPU; use IBL + baked AO.

### 4. Post-processing & color
**Current:** no post chain; `antialias:true` hardcoded; tonemapping unset; **SKILL.md/webgpu-tsl.md contradict STACK.md** (still recommend pmndrs/EffectComposer).
**Target:** one tier-gated native node chain — scenePass(MRT) → GTAO → bloom → optional DoF → SMAA/TRAA → AgX → grade → output.
**Steps:** resolve contradiction → ship `PostFX.tsx` + fix AA default → AgX/exposure/grade → AA decision tree → auditor checklist → pin 0.184 node API.
**Touchpoints:** `SKILL.md`, `webgpu-tsl.md`, NEW `PostFX.tsx`, `Stage.tsx`, `Scene.tsx`, `useQualityTier.ts`.
**Verified:** `RenderPipeline` is current (PostProcessing deprecated r183, alias). Nodes at `three/addons/tsl/display/` (BloomNode, GTAONode, SMAANode, DepthOfFieldNode + TRAA/FXAA/SSGI/Lut3D) — confirmed in r184. **AA correction:** `antialias:true` *does* multisample the off-screen pass on WebGPU; do not blindly force it off.

### 5. Asset pipeline & sourcing
**Current:** no `public/`, loaders, transcoder, or encode script; CC0 sources named in prose.
**Target:** every mesh Draco/meshopt-compressed, every texture KTX2/Basis, self-hosted transcoder (GDPR no-CDN), WebGPU-correct loaders; channel-packing + CC0 license playbook; baked/video hero as the photoreal escape hatch.
**Steps:** transcoder + loader helper → `encode-assets.mjs` → asset-pipeline reference + channel-pack convention → CC0 license checklist → baked/video hero recipe → Gaussian-splat spike.
**Touchpoints:** NEW `/public/basis/`, `/public/draco/`, `src/lib/loaders.ts`, `scripts/encode-assets.mjs`, `references/asset-pipeline.md`; `package.json` devDeps.
**Verified:** gltf-transform emits ETC1S+UASTC per-texture AND Draco/meshopt in one scripted pipeline (KTX2 via CLI `toktx`, needs KTX-Software binary). 3DTexel atlases = CC0, PNG (Albedo+Normal+Opacity+Height+Roughness) → KTX2 in-pipeline. three's `KTX2Loader.detectSupport(renderer)` is the WebGPU-safe path (after `renderer.init()`).

### 6. Animation, wind, physics & "alive"
**Current:** the one-RAF/one-owner law is implemented and excellent; wind, compute particles, gestures, physics all absent (`@react-three/rapier` not a dep; `@use-gesture` installed-but-unused).
**Target:** four motion systems under the composition law — multi-layer TSL wind · GPU compute particles · rapier bodies + character · gesture→damped-value→one-owner — all tier-gated and reduced-motion-aware.
**Steps:** "alive" composition reference → `wind.ts` + `FoliageField.tsx` → `ComputeParticles.tsx` → add rapier + `PhysicsStage.tsx` → worked gesture example → tier budgets → auditor + verify-under-load.
**Touchpoints:** NEW `references/animation-and-alive.md`, `src/canvas/tsl/wind.ts`, `particles/`, `physics/`, `interactions/`; `package.json`; `useQualityTier.ts`.
**Verified:** compute path = `instancedArray` + `Fn` + `renderer.compute`/`computeAsync` + `positionNode = buffer.toAttribute()`. rapier **absent** — must add. ecctrl = floating-rigidbody (not Kinematic), v2 compatible with R3F9/React19/three 0.184.

### 7. Performance, fallback & mobile
**Current:** tier hook (static, `deviceMemory`-dependent, one mesh) + live reduced-motion + 3-level fallback + DPR cap + single RAF. No profiling tooling, no adaptive layer, no instancing, text-only Poster.
**Target:** measured, tiered, gracefully-degrading; profiling culture (r3f-perf, Spector, throttled-mobile DevTools, Lighthouse); adaptive rendering; instancing seam; explicit backend gate; real visual Poster.
**Steps:** install r3f-perf + Lighthouse script → robust tier → adaptive layer → InstancedMesh budget seam → backend gate → visual Poster.
**Touchpoints:** `package.json`, `useQualityTier.ts`, `Stage.tsx`, `Scene.tsx`, NEW `DevPerf.tsx`/`Instanced.tsx`/`useRenderBackend.ts`, `Poster.tsx`.
**Verified:** drei `<PerformanceMonitor>`/`<AdaptiveDpr>`/`<AdaptiveEvents>` present in 10.7 (`onDecline`/`onIncline`/`factor`). `isWebGPURenderer` correct but stays true on WebGL2 fallback.

### 8. Reference benchmarks & measuring "real"
**Current:** only Bruno Simon named; no roster, realism-bar protocol, A/B workflow, or perceptual checklist; nobody owns "looks real vs. the benchmark."
**Target:** a tiered roster + per-project realism bar in `ARCHITECTURE.md` + repeatable A/B capture + scored perceptual checklist + an agent that owns the realism gate.
**Steps:** roster doc → realism-bar protocol → A/B workflow → scored checklist → agent ownership → runtime fidelity capture in the verify loop.
**Touchpoints:** NEW `references/reference-benchmarks.md`, `ARCHITECTURE.md` realism-bar block, `realism-and-interactivity.md` §A.7/§E, `perf-fallback-auditor.md`.
**Verified:** False Earth = compute + storage + indirect + ~80% GPU cull — **but "AAA grass requires compute" is refuted**; classic InstancedMesh still does ~1M blades. AgX & ACES both in 0.184. r3f-perf usable on the stack.

### 9. Interactivity & DOM/overlay
**Current:** single-loop wiring correct (Lenis `autoRaf:false`→`gsap.ticker`, scroll-in-a-ref, Motion DOM-only); React Bits vendored-not-integrated; **`ScrollReveal` cleanup kills ALL ScrollTriggers**; several cursor/bg comps self-RAF; overlay is a hero skeleton; `@use-gesture` unused; `<Html>` portal fix is prose.
**Target:** provably-single RAF (React Bits re-pointed at Lenis via `scrollerProxy`), scroll/pointer→uniform with one owner, accessible overlay over a moving canvas, correct clickable `<Html>`, intentful React Bits selection.
**Steps:** Lenis↔ScrollTrigger bridge + wiring rule → reusable scroll/pointer hooks → accessible overlay kit → `<OverlayLayer>` primitive → React Bits cheat-sheet → browser-verify gate (single-loop + hit-test + contrast + focus + reduced-motion).
**Touchpoints:** `SmoothScroll.tsx`, NEW `useScrollProgress.ts`/`usePointerDamp.ts`/`Scrim.tsx`/`OverlayLayer.tsx`; `Overlay.tsx`; `interactive-components.md`; `lib/react-bits/CATALOG.md`; auditor.
**Verified:** `getAll().kill()` hazard confirmed by reading the vendored source — patch before wiring.

### 10. Tooling, verification & agents
**Current:** strong soft system (6 agents, bilingual auto-dispatch hook, skill + 6 references, sane version pins); broken CI (webpack on Vite); zero automated verification; agent-memory half-wired (dir absent, 5/6 agents lack frontmatter); no dep cadence; still a one-demo starter.
**Target:** mechanical verification + currency — real Vite/lint/typecheck CI, Playwright WebGPU smoke + screenshot diff, preview-MCP gate in the auditor, persistent agent memory, gated dependency cadence, a `recipes/` toolkit.
**Steps:** replace CI → add smoke test → make preview-verify mandatory in auditor → wire agent memory (all 6) → dependency cadence → recipes toolkit.
**Touchpoints:** delete `webpack.yml` → `ci.yml`; NEW `tests/smoke.spec.ts`, `playwright.config.ts`, `eslint.config.js`, `.claude/agent-memory/`, `recipes/`, `.github/dependabot.yml`; `perf-fallback-auditor.md`.
**Verified:** WebGPU post = native node graph (PostProcessing/RenderPipeline + `three/addons/tsl/display/*`), not pmndrs. Headless CI is GPU-less → mostly WebGL2 path.

---

## 6. Stack & library decisions

| Library | Role | Status | Note |
|---|---|---|---|
| three 0.184 (`three/webgpu`, `three/tsl`) | Renderer, node materials, compute, instancing | **in-stack** | The whole material/compute/instancing surface lives here; mostly unused in `src/`. |
| `THREE.InstancedMesh` | Many copies of one geo/material, one draw call | **in-stack** | Default for dense fields. Per-instance via `setMatrixAt` + `InstancedBufferAttribute`. |
| `THREE.BatchedMesh` | Many distinct geos under one material | **in-stack** | Per-instance cull via `perObjectFrustumCulled`; reassign via `setGeometryIdAt`. **No native LOD.** |
| TSL compute + `IndirectStorageBufferAttribute` + `setIndirect()` | GPU-driven instance count | **in-stack** | WebGPU-only; gate behind `isWebGPURenderer`. Showcase, not default. |
| `MeshPhysicalNodeMaterial` | transmission / iridescence / clearcoat | **in-stack** | All confirmed on WebGPU 0.184 (node props are `*Node`). |
| drei `<Environment>` / `<Lightformer>` | IBL / studio rig | **in-stack** | `environmentIntensity`/`environmentRotation` confirmed. Self-host, no CDN. |
| drei `<AccumulativeShadows>` / `<ContactShadows>` / `<Detailed>` | Grounding shadows / per-object LOD | **in-stack** | Smoke-test shadow helpers under WebGPURenderer. |
| drei `<PerformanceMonitor>` / `<AdaptiveDpr>` / `<AdaptiveEvents>` | Adaptive quality | **in-stack** | Confirmed in 10.7. |
| `RenderPipeline` + `three/addons/tsl/display/*` | WebGPU post chain (bloom/GTAO/SMAA/DoF/TRAA/Lut3D) | **in-stack** | `PostProcessing` is the deprecated alias. **GTAO only — no WebGPU HBAO.** |
| AgX / ACESFilmic tonemapping (+exposure) | Output transform | **in-stack** | AgX default, ACES alt; both honored on WebGPU. |
| three `KTX2Loader` / `DRACOLoader` / `MeshoptDecoder` | Runtime decode | **add (wire)** | Self-host transcoders; `detectSupport(renderer)` after `init()`. |
| `@gltf-transform/{core,functions,cli}` | Offline encode (Draco/meshopt + KTX2) | **add** | One scripted pipeline; KTX2 via `toktx` (needs KTX-Software). |
| gltfpack | One-binary glTF optimizer | **evaluate** | Pick one default vs gltf-transform; document the other. |
| `@react-three/rapier` (+ ecctrl) | Physics + character | **add** | **Not a dep today.** ecctrl = floating rigidbody, not Kinematic. |
| `@use-gesture/react` | Drag/pinch/wheel | **in-stack** | Installed but unused; needs one worked example. |
| gsap 3.13 / `@gsap/react` / lenis 1.3 / motion 12 | Single-RAF scroll + DOM motion | **in-stack** | Motion is DOM-only; never a second RAF. |
| React Bits (vendored) | Copy-first interactivity flourishes | **in-stack** | Copy+tune; audit each for self-RAF / `getAll().kill()`; gate heavy bg on low. |
| ogl 1.x | Lightweight GLSL backgrounds | **in-stack** | Gate OFF on low; never stack with the WebGPU canvas. |
| maath | random/easing for WebGL2 fallback fields | **in-stack** | — |
| three-mesh-bvh | Raycast/spatial queries vs instanced/merged | **evaluate** | Only if picking/collision needed; confirm WebGPU compat. |
| r3f-perf | Dev overlay (draw calls/tris/GPU time) | **add (dev)** | Makes the auditor rubric runnable. |
| `@playwright/test` | Headless WebGPU smoke + screenshot diff | **add** | Machine backing for "green build is not proof." |
| eslint + `@react-three/eslint-plugin` + react-hooks | Static R3F/hook checks | **add** | Can mechanically enforce the framer-motion-3d ban. |
| renovate / dependabot | Grouped 3D-cluster cadence | **add** | Gated by CI + smoke. |
| `@mkkellogg/gaussian-splats-3d` | Capture-to-web splats | **evaluate** | Often WebGL2-only; fallback/quality-gated at best. |
| `@react-three/cannon` | Alt physics | **evaluate** | Default to rapier. |
| vitest | Unit tests for pure hooks/math | **evaluate** | Lower priority than browser smoke. |
| **webpack** | (old CI bundler) | **avoid** | Project is Vite; the CI invoking it is dead — remove. |
| **`@react-three/postprocessing`** | WebGL EffectComposer | **avoid** | Fights WebGPU; use native node graph. WebGL2-only builds excepted. |
| **0beqz/realism-effects (SSGI/TRAA)** | WebGL2 effects | **avoid** | pmndrs-postprocessing-based, PerspectiveCamera-only; not on WebGPU. Mine for ideas only. |
| **mattdesl SSS gist** | Backlit translucency hack | **avoid** | Refuted; use `MeshPhysicalNodeMaterial.transmission`. |
| **drei `<Instances>` for dense foliage** | Declarative instancing | **avoid (dense)** | CPU overhead confirmed >~1–2k; use native InstancedMesh/BatchedMesh. |
| **drei `useKTX2` on WebGPU** | KTX2 hook | **avoid (prefer three's loader)** | Wraps three's loader; real risk is init-order, not `extensions.has`. |
| **framer-motion-3d** | `motion.mesh` | **avoid (banned)** | Discontinued, breaks React 19. Animate via useFrame/TSL/GSAP/rapier. |
| **react-scroll-parallax / AOS / locomotive-scroll** | Alt scroll | **avoid** | Second RAF; fights Lenis. |
| **`@react-three/lamina`** | Layered materials | **avoid** | WebGL/GLSL-era; compose in TSL nodes. |
| **Quaternius MegaKit** | CC0 stylized nature | **avoid (photoreal)** | Wrong aesthetic; prototyping/stylized only. |

---

## 7. How we keep improving (the loop)

1. **Deep-research → distill.** This roadmap was produced by fan-out research → adversarial verification → distillation. Repeat per frontier topic: never schedule work on an unverified claim (this pass refuted BatchedMesh-native-LOD, the useKTX2 crash mechanism, the antialias-off rule, and "AAA grass requires compute" — all corrected here).
2. **Browser-verify gate.** Every new module is verified in a real preview (Playwright in CI + `mcp__Claude_Preview__` in-session) before "done." Build-green never counts as proof.
3. **Version cadence.** Grouped 3D-cluster dependabot PRs, gated by CI + smoke; a quarterly "STACK refresh" checklist (bump → build → smoke → screenshot review → re-pin + note) replaces "take the latest stable."
4. **Agent-memory accrual.** `.claude/agent-memory/` per agent records verified gotchas (KTX2 init order, GTAO RedFormat, drei `<Instances>` overhead, `setGeometryIdAt` naming) so lessons compound instead of being relearned.
5. **Benchmark re-scoring.** Refresh the reference roster as the Awwwards/FWA/Codrops galleries turn over; re-score the perceptual checklist against the new bar; update the honest-ceiling line when the browser actually moves (WebGPU adoption, new TSL nodes).

---

## 8. Risks & guardrails

- **The in-browser ceiling is real.** ~1.5–3M tris desktop / ~500K mobile, low-hundreds draw calls, hundreds–low-thousands of rigid bodies, DPR ≤2. No Nanite, no real-time GI, no virtual shadow maps. For pixel-faithful photoreal: **video/baked backdrop + interactive 3D secondary layer.** Bake this honesty into every brief's realism bar.
- **Scope creep.** Build foundations before disciplines before polish (§3). Compute/indirect grass, SSGI, DoF, splats are *frontier/showcase*, not defaults — gate them and label them as such.
- **Perf regressions.** The auditor must have teeth beyond draw calls: on-screen triangle budget, per-object LOD, impostor far-LOD, post tier-gated/off-on-low, no double-owner (rapier + useFrame), one compute dispatch/frame, reduced-motion freezes each system. Profile on a real throttled mid-tier Android before "done."
- **Don't schedule refuted work.** Build only on confirmed facts: no BatchedMesh native LOD, no WebGPU HBAO, no `setGeometryIdForInstance`, no "compute is required for grass," no `antialias:false` dogma, no useKTX2-`extensions.has` story.
- **The non-negotiables (override everything).** One RAF loop (Lenis→gsap.ticker). One owner per property (rapier owns body transforms; one consumer per uniform; one camera owner). No framer-motion-3d (banned). Mobile + a11y are in the definition of "done," not afterthoughts. Self-host assets (GDPR, no CDN). Verify in a real browser — a green build is not proof.
- **Parallel-agent hazard.** Commit between phases; parallel subagents + `git stash` silently discard tracked edits. Isolate concurrent sessions in a git worktree.
