# r3f-scene-architect — project memory

Project root: /home/user/3dwebsitedeveloper
Stack date: June 2026. Three r184 (npm `three@^0.184.0`), R3F v9, React 19, TSL, WebGPU-first.

## Current brief (decided 2026-06-11 — supersedes the original scroll-morph hero)

**Live city simulator, realistic style.** Fullscreen WebGPU 3D app. No page scroll, no Lenis.
- Procedural seeded city: grid of blocks, buildings as a few InstancedMesh archetypes with
  per-instance variation, roads + sidewalks between blocks.
- Continuous sim clock: day/night cycle (~2 real min per game day default), pause/speed/scrub.
  Drives sun, sky, window lights, lamps, headlights.
- Traffic: cars on road lanes. SHADER ENGINEER implements motion in TSL (runs on WebGPU + WebGL2),
  optional WebGPU compute enhancement. Architect defines lane/path data + instanced car buffers.
- Pedestrians: stretch, high tier only — documented extension point only, do NOT build.
- Camera: damped constrained orbit (min/max dist, clamped polar so never below ground), touch,
  pointer parallax + idle drift. Architect provides rig skeleton; motion engineer tunes.
- Realistic look from PROCEDURAL TSL (shader engineer) + lighting/fog/ACES + 1 shadow sun.
  NO external asset downloads.
- DOM control panel (UI agent, later): time-of-day, play/pause, speed, traffic density, quality.

## Key architectural decisions (this project)

1. **One per-frame driver = R3F's `useFrame` loop.** Original CLAUDE.md rule 3 ("Lenis + gsap.ticker
   single RAF") is ADAPTED: there is no scroll, so Lenis is removed. R3F's internal RAF is the only
   per-frame source. GSAP is kept ONLY for one-shot tweens on values nothing else drives per-frame
   (e.g. tweening the sim's `dayPhase` when the user scrubs the slider, or a camera fly-to). GSAP
   must never co-drive a uniform/transform that `useFrame` also writes. Documented in ARCHITECTURE.md.
2. **No drei.** Hand-rolled damped orbit rig (spherical coords, `MathUtils.damp`) instead of
   `OrbitControls`. Reasons: keep one-owner-per-property clean, avoid drei writing its own internal
   camera state, no browser storage, fewer deps, motion engineer fully owns the tuning. drei can be
   added later if a specific helper is needed; not needed for the skeleton.
3. **SimClock = context + ref, not state.** `SimClockProvider` holds a single mutable ref
   (`{ simSeconds, dayPhase, paused, speed, secondsPerDay }`) advanced in ONE `useFrame` inside the
   canvas (`SimClockDriver`). UI reads/writes via an imperative API object (also in context) — no
   per-frame React re-render. The slider scrub sets `dayPhase`/`simSeconds` directly through the API.
4. **Per-instance data via `InstancedBufferAttribute` + TSL `instancedBufferAttribute(attr)`.**
   Verified against three.js r184 `examples/webgpu_instance_path.html`: build typed-array attributes,
   wrap with `instancedBufferAttribute()`, read in `positionNode`/`colorNode`. Car motion is computed
   in-shader from `time` + per-instance phase/seed, so it runs on BOTH backends (the brief's
   requirement). This is the contract handed to the shader engineer.
5. **Layout generator is a PURE seeded function** (mulberry32 PRNG). Returns plain arrays
   (blocks, building instances, road segments, lane paths). Deterministic for a given seed+tier.
   No three.js objects inside it — easy to test, easy for shader/motion agents to consume.
6. **Placeholder materials = `MeshStandardNodeMaterial`** (node material so the shader engineer
   swaps `colorNode`/`positionNode` in place without changing the mesh wiring).

## Verified r184 APIs (from vendored /three.js, do NOT import from there in app code)

- `attribute('name','type')` and `instancedBufferAttribute(bufferAttribute)` — per-instance reads.
- TSL exports present: `attribute, instancedBufferAttribute, instancedArray, instanceIndex,
  cameraPosition, modelWorldMatrix, positionLocal, normalLocal, time, uniform, vec3, Fn, mod, select`.
- Renderer constants present: `ACESFilmicToneMapping, FogExp2, PCFSoftShadowMap, VSMShadowMap`.
- `WebGPURenderer.init()` async + automatic WebGL2 fallback. `renderer.isWebGPURenderer` for gating.
- Vendored three.js is exactly 0.184.0 → `@types/three@^0.184.0` matches.

## Conventions

- Absolute paths only. tsconfig `include` is `["src"]` — keep three.js/ out of the app build.
- `.gitignore`: node_modules/, dist/.
- Canvas wrapper `aria-hidden`; all real controls live in accessible DOM (the panel).
- Quality tier hook drives: block count, car count, shadows on/off, shadow map size, dpr cap (<=2),
  building subdivision. Mobile/touch = low tier.
- prefers-reduced-motion: pause idle camera drift + pointer parallax, freeze sim at current dayPhase
  (no auto day/night advance), keep panel fully operable so the user can still scrub manually.

## Build/verify

- `npm install` then `npm run build` (= `tsc -b && vite build`) must pass before finishing.
