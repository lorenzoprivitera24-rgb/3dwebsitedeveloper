# Realism & interactivity playbook (June 2026)

How to make a 3D site look *real* and feel *interactive* — and the specific WebGPU/TSL runtime
bugs that pass the build and break on screen. Read this before claiming a 3D scene is done.

> **THE RULE: build-green ≠ works.** `tsc -b && vite build` passing tells you nothing about whether
> WebGPU renders. Every gotcha below passed the build. **Verify in a real browser preview**
> (start a dev/preview server, screenshot, read `console` errors) before saying "done". If you only
> have a headless preview, drive it to the high quality tier (resize ≥1280px), and remember a
> programmatic `window.scrollTo` does NOT drive Lenis — test scroll-linked things on a real browser.

---

## A. What actually makes 3D look real

1. **PBR materials + real textures.** Procedural green ≠ realism. Ship **KTX2 (Basis)** maps:
   `albedo` (sRGB), `normal` (linear), `roughness` (linear), mip-mapped, ZSTD-supercompressed.
   Source CC0 from Poly Haven / ambientCG; encode with `toktx` (KTX-Software).
2. **Anti-tiling is non-negotiable.** A repeating texture grid + per-face UV seams is the #1 "fake"
   tell. Use **triplanar** sampling (project world XYZ on 3 axes, blend by the normal). Optionally
   blend two world scales to dissolve residual tiling. This single change moves a surface from
   "video-game box" to "real".
3. **Image-based lighting.** One HDRI via drei `<Environment>` + one key directional sun beats a
   pile of point lights. Self-host the HDRI (no CDN). Tune intensity to the mood (bright midday vs
   golden hour) — it sets the whole feel.
4. **Post-processing.** Bloom on sunlit highlights + **GTAO** ambient occlusion for contact shadows.
   Tasteful, gated to capable tiers.
5. **Tonal modelling + organic form.** Bright sunlit tops, darker shaded sides/recesses. Break boxy
   silhouettes with multi-octave TSL vertex displacement (per-instance domain-warped). Vary subtly
   per instance so a repeated mesh reads as many individuals of one species.
6. **Atmosphere.** A whisper of fog/haze at the horizon adds depth; warm color keeps the brand.
7. **Reference-match.** When the client gives a reference (a video/photo), extract frames
   (`ffmpeg -ss T -i ref.mp4 -frames:v 1 out.jpg`) and match color/density/light against it.

## B. What makes it feel interactive

- **Scroll narrative**: GSAP ScrollTrigger (scrubbed) on a Lenis-smoothed scroll, driving a camera
  walk / uniform / reveal. Keep ONE loop.
- **Pointer/gesture**: `@use-gesture/react` for drag/pinch/hover; R3F unifies mouse+touch in
  `state.pointer` ([-1,1]). Damp pointer input (`MathUtils.damp`) — raw pointer feels twitchy.
- **Physics**: `@react-three/rapier` for things that fall, swing, collide (e.g. a lanyard, cards).
- **Component interactivity**: React Bits (`lib/react-bits/`) — cursors, magnets, hover/scroll
  effects, animated menus, galleries. See `interactive-components.md`.
- **Tune the feel.** "Too fast / too sensitive" is usually: scroll track too short (lengthen it →
  more scroll per beat), pointer parallax too strong (halve the magnitude), or damping λ wrong.

---

## C. WebGPU / TSL / R3F runtime gotchas (all of these passed the build)

These are real, reproduced bugs. Check for them.

### 1. drei `useKTX2` CRASHES on `WebGPURenderer`
drei's `useKTX2` loads via **three-stdlib's** `KTX2Loader`, whose `detectSupport(renderer)` reads
`renderer.extensions.has(...)`. WebGPURenderer has no `.extensions` → `TypeError: ...reading 'has'`
→ the canvas error boundary trips → the whole 3D falls back to the poster.
**Fix:** load with **three's own** loader (`three/examples/jsm/loaders/KTX2Loader.js`), which has the
`renderer.isWebGPURenderer` branch (`hasFeature(...)`). Wrap it in `useLoader`:
```ts
const tex = useLoader(KTX2Loader, urls, (l) => { l.setTranscoderPath('/basis/'); l.detectSupport(gl) })
```
Self-host the Basis transcoder in `public/basis/` (copy from `three/examples/jsm/libs/basis/`).

### 2. GTAO turns the whole scene RED
three's `GTAONode` writes a **single-channel `RedFormat`** AO map. Composing `aoTex.mul(color)`
multiplies `(ao,0,0)` × color → green & blue become 0 → **everything is red** (only at the tier where
AO runs). Canonical composition (GTAONode docs):
```ts
output = output.mul(vec4(vec3(aoPass.getTextureNode().r), 1))
```
Also: GTAO needs real view-space normals — configure the pass MRT (`scenePass.setMRT(mrt({ output, normal: normalView }))`) or `getTextureNode('normal')` returns garbage.

### 3. `THREE.PostProcessing` is deprecated (r183) → use `RenderPipeline`
Same API (`outputNode`, `render()`); `PostProcessing` `warnOnce`-spams and may be removed. On WebGPU
do NOT use pmndrs `@react-three/postprocessing` (WebGL EffectComposer) — use three's node post chain
(`PostProcessing`/`RenderPipeline` + TSL `pass`/`bloom`/`ao`).

### 4. Clickable drei `<Html>` overlays are NOT clickable by default
drei `<Html>` portals into the canvas's parent layer, which sits BEHIND the scrollable DOM content
(`z-index`). The page content intercepts every click. **Fix:** portal the Html into a dedicated
fixed layer ABOVE the content but below the header (`pointer-events:none` on the layer, `auto` on the
interactive children): `<Html portal={layerRef} …>`. Verify with `document.elementFromPoint(cx,cy)`.

### 5. `bloom` composition order
`color.add(bloom(color, strength, radius, threshold))`. Strength 0.55 washes a whole scene pale;
0.3 + a high threshold (0.92) blooms only the brightest crowns.

### 6. Quality tier never recomputes
Computing the tier once in `useMemo([])` strands a rotated/foldable device on `low`. Recompute on
`resize`/orientation (debounced), commit only when the tier label changes.

### 7. Headless preview WebGPU is flaky
Fresh loads can stick at a 1px / 300×150 canvas; dispatch a `resize` event to kick R3F's
ResizeObserver. A `location.reload()` in headless can leave the WebGPU context half-mounted — prefer
stop/start the server fresh over reload.

---

## D. Orchestration gotchas (when several agents build in parallel)

- **`git stash` hazard.** Parallel subagents editing one working tree: if one runs `git stash` to
  test a build in isolation, it wipes the **uncommitted, tracked-file** edits of the others (new
  untracked files survive — which masks it). **Commit between phases**, forbid agents from using
  `git stash`/`checkout`, and after a parallel wave check `git status` against what each agent claims
  it edited — a "modified" file that isn't there was clobbered; re-apply it.
- **Disjoint files.** Partition ownership so parallel agents touch different files (architect: scene
  wiring; shader: material; motion: camera/loop; ui: DOM). Shared shading constants → append-only.

---

## E. The verify loop (do this before "done")

1. Start a preview (dev or `vite preview` on the built `dist`).
2. Drive to the high tier (headless previews default to a small viewport = low tier; resize ≥1280px;
   if the canvas is stuck, dispatch a `resize` event).
3. **Screenshot.** Look for: right colors (not red/washed), no tiling grid, no poster fallback,
   readable overlay, organic shapes.
4. **Read `console` at `error` level.** Zero errors. A poster + a `TypeError` = a runtime crash.
5. For interactive elements: `document.elementFromPoint` to confirm hit-testing, real click to
   confirm navigation. Scroll-linked feel: judge on a REAL browser (Lenis isn't driven by
   programmatic scroll).
6. If anything's off, fix the source and re-verify. Never ship "build is green" as proof.
