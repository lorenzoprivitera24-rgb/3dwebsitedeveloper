# Realistic vegetation & foliage on the web (state of the art, 2026)

How to render believable hedges / grass / trees in real time on the web with three.js (0.184,
WebGPU/WebGL2) + R3F v9. This is **verified, cited** research (deep-research, 27 sources, 25
adversarially-verified claims). Read it before attempting realistic greenery — and to know what
NOT to do.

> **The core lesson:** a procedural *solid box* hedge with a clever shader **cannot** look real. The
> professional standard (games AND the best web 3D) is **instanced alpha-tested LEAF CARDS** on a
> leaf atlas — not boxes, not per-leaf sculpting. Boxes lack the frayed silhouette and the layered
> depth of a real foliage mass; real per-leaf geometry would be millions of triangles. [80.lv,
> Polycount, Bruno Simon]

## 1. Geometry — leaf cards, instanced
- **Small plants / leaves / grass / hedges:** flat **cards** (single or crossed quads) with a
  transparency (opacity) map. **Large assets (trees, tall hedges):** cards for the canopy + standard
  **solid geometry** for the trunk/main structure. [80.lv, Polycount wiki, SpeedTree]
- **Render thousands of cards via native `THREE.InstancedMesh`** (one draw call, per-instance
  transform). Do **NOT** use drei's declarative `<Instances>` for dense foliage — it carries real CPU
  overhead (drei's own docs say use `THREE.InstancedMesh` directly for foliage). Heterogeneous cards
  (different atlas regions/sizes) → consider `BatchedMesh` (three 0.184). [R3F scaling-performance,
  drei docs — *refuted* that `<Instances>` scales to 100k]
- **Budget:** the real ceiling is triangle/vertex count (~3M sweet spot), not just draw calls. Keep
  cards light, add **LOD** + chunking/culling. Reference: Bruno Simon's portfolio — grass = ~78,400
  single-triangle blades, looped seamlessly; tree foliage = camera-facing planes with **SDF**-textured
  leaves; trunks = standard 3D geometry; heavy instancing throughout. (Single-triangle blades are his
  low-cost choice — AAA grass uses 7–15-vertex tapered Bézier blades; Codrops "Fluffiest Grass" ~7.)
  [awwwards Bruno Simon case study, Codrops, Ghost of Tsushima GDC]

## 2. Material
- **Alpha edge:** use **`alphaHash`** (three r154+, present in 0.184) instead of `transparent`. It
  keeps the material **opaque** (`transparent=false`, `depthWrite=true`) so there are **no back-to-front
  sorting problems**. Trade-off: it's **dithered/noisy** → must be cleaned up by **temporal AA (TAA/TRAA)**
  (the official `webgl_materials_alphahash` example pairs it with a `TAARenderPass`). `alphaToCoverage`
  is the MSAA alternative (needs an MSAA context) — which gives better foliage edges on WebGPU is an
  open question, test both. [threejs.org alphahash example + docs; Wyman/McGuire "Hashed Alpha Testing"]
- **Translucency / SSS (back-lit leaves):** a **two-sided foliage** shader with subsurface
  scattering / transmission — light passing *through* the leaf is the #1 "alive" cue. In three.js use
  **`MeshPhysicalMaterial.transmission`** or a dedicated **SSS node material** (`MeshSSSNodeMaterial`),
  or a thickness-map approximation (inverse N·L tint). **DO NOT** inject SSS via shader-chunks into
  `MeshStandardMaterial` (the popular mattdesl gist — *refuted 0-3*). Channel-pack: roughness +
  transmission + colour-mask in one map, alpha in the diffuse, normal separate. [80.lv; UE Two-Sided
  Foliage; TU Wien "Real-Time Translucency for Leaves"; GDC Frostbite/Battlefield 3; NVIDIA GPU Gems 3 Ch.16]
- **Wind:** a **multi-layer** system, not one sine — global low-freq sway (whole field bends) + rolling
  gust waves (mid-freq fronts) + per-blade/leaf turbulence (high-freq flutter), all in the **vertex
  stage via TSL nodes** (zero per-frame JS). [CK42BB/procedural-grass-threejs; NVIDIA GPU Gems 3 Ch.16
  (Crysis main+detail bending); SpeedTree wind]

## 3. Assets (CC0)
Leaf **atlases** = Albedo + Normal + **Opacity**, 4K PNG. The cards/cross-quads must still be authored
— **no CC0 ready-made photoreal HEDGE model exists** (Poly Haven plants are ground photogrammetry, not
hedges). Apply KTX2 compression in our own pipeline (downloads are PNG).
- **3DTexel** (`3dtexel.com/atlases/`) — handcrafted leaf atlases (Clover, Large Green Leaf, Lonicera…),
  3 maps Albedo/Normal/Opacity at 4K/2K PNG, **CC0, commercial, no attribution**. Best fit.
- **ambientCG `LeafSet004`** — CC0 leaf atlas.
- **Poly Haven** — CC0 plant models/textures (ground plants, not hedges).
- **Avoid for photoreal:** stylized low-poly packs (e.g. Quaternius Stylized Nature — Ghibli look).

## 4. Supporting techniques
- **Anti-aliasing — the rule DIFFERS by backend** (fact-check corrected, June 2026). On **legacy WebGL +
  EffectComposer**, canvas `antialias` does nothing in a post pipeline (geometry renders to an off-screen
  target) → AA in post. On the **native WebGPU node pipeline the OPPOSITE holds**: `WebGPURenderer` wires
  `antialias:true → renderer.samples=4` and `PassNode`'s off-screen targets honor it, so MSAA **does**
  multisample the scene pass — so do **NOT** blindly force `antialias=false`; choose MSAA (`samples`) vs a
  shader AA pass on perf/quality grounds (per maintainer Mugen87 / three PR #28784). **MSAA can still
  artifact with depth-based effects (SSAO/GTAO)** → pair GTAO with temporal AA. For thin alpha-foliage
  shimmer the answer is **temporal AA (TRAA)**; `0beqz/realism-effects` TRAA is WebGL2-legacy (pmndrs
  `postprocessing`, PerspectiveCamera only), **not** WebGPU/TSL-native → on WebGPU use the node graph's
  `smaa()` or a custom TAA node. Full reasoning: `photoreal-3d-research-dossier.md` finding 7.
  [pmndrs/postprocessing AA wiki; three PR #28784]
- **Post on WebGPU = native three node graph** (`THREE.PostProcessing`/`RenderPipeline` + `three/tsl`
  + `three/addons/tsl/display/*`: bloom, ao, smaa, …), **NOT** `@react-three/postprocessing` (WebGL
  EffectComposer — fights WebGPU). The `ektogamat/r3f-webgpu-starter` ships zero postprocessing pkg.
  (We already do this in PostFX.) [r3f-webgpu-starter]
- **Tonemapping:** `THREE.AgXToneMapping` (generally preferred in 2025-26 for saturated colours/
  highlights) or `ACESFilmicToneMapping`; apply in the output transform. **Open:** exact GTAO/DoF TSL
  node APIs in 0.184 — verify in the source before wiring.

## 5. Realistic ceiling (set expectations)
This path reaches **excellent *web* foliage** (Bruno-Simon / top-awwwards level) — believable, dense,
alive. It is **not** literally GTA V / RDR2 AAA: those use engine-specific tech (UE5 Nanite voxelized
foliage at 1–10M poly, full GI, virtual shadow maps) that does not run in a browser. For *true*
photoreal in a hero, the only pixel-faithful option is real/generated **video or a baked render** as
the backdrop, with the interactive 3D as a secondary layer.

## 6. The pivot for THIS kit's maze (concrete next step)
Replace the procedural box-hedge `InstancedMesh` with a **leaf-card hedge**: keep a thin solid wall as
the base/occluder, then scatter **thousands of instanced alpha-card leaf clusters** over the wall
volume (InstancedMesh, leaf atlas, `alphaHash`, two-sided + transmission, multi-layer TSL wind), add a
**TRAA/SMAA** pass and AgX tonemap. That is the de-"bad-3D" rebuild — a real re-architecture of
`HedgeMaze`, not a shader tweak.

---
### Verified sources
80.lv alpha-cards · Polycount foliage wiki · threejs alphaHash example+docs · NVIDIA GPU Gems 3 Ch.16 ·
GDC Frostbite translucency · TU Wien leaf translucency · CK42BB/procedural-grass-threejs · Codrops
Fluffiest Grass · 3dtexel.com/atlases · ambientCG LeafSet004 · Poly Haven · R3F scaling-performance ·
drei Instances docs · pmndrs/postprocessing AA wiki · 0beqz/realism-effects · ektogamat/r3f-webgpu-starter ·
awwwards Bruno Simon case study.
### Refuted (do NOT use)
- SSS via GLSL shader-chunks in `MeshStandardMaterial` (mattdesl gist) — 0-3. Use `MeshPhysicalMaterial.transmission` / SSS node material.
- drei `<Instances>` for 100k+ leaf cards — 1-2. Use native `THREE.InstancedMesh` / `BatchedMesh`.
