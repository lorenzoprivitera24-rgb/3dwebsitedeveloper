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

## Final concrete layout (built 2026-06-11, build green)

File map (all under src/):
- App.tsx (SimClockProvider + quality override state + CITY_SEED=1337 + shell)
- sim/SimClock.tsx (ref + imperative SimClockApi via context; advanceClock pure fn),
  sim/SimClockDriver.tsx (THE single time useFrame: advances clock, drives sun light + simUniforms
  + scene fog/background), sim/uniforms.ts (shared simUniforms: uTime, uDayPhase, uDaylight,
  uSunDirection — single writer = driver), sim/sun.ts (computeSun + computeSkyColor, pure).
- city/types.ts (CityLayout/BuildingInstance/GroundQuad/Lane — plain data),
  city/generateCity.ts (pure mulberry32; CITY_CONSTANTS: BLOCK 40, ROAD 12, SIDEWALK 3, CELL 52,
  CAR_DECK_Y 0.4), city/buildCarInstances.ts (pure car buffers + motion formula doc),
  city/Buildings.tsx (3 instanced archetypes, base-pivoted unit box, aFacade vec2 attr),
  city/Ground.tsx (1 ground mesh + instanced roads/sidewalks unit planes), city/Traffic.tsx
  (instanced box cars, attrs aLaneStart/aLaneDir/aLaneLength/aPhase/aSpeed/aCar, frustumCulled=false).
- camera/CameraRig.tsx (hand-rolled damped Spherical orbit, pointerdown/move/up + wheel listeners,
  ground-clamp maxPolar<PI/2). canvas/Stage.tsx (async WebGPU, error boundary, frameloop=always,
  camera far=6000), canvas/Scene.tsx (generateCity + sizes camera/shadow to extent),
  canvas/RendererConfig.tsx (ACES + PCFSoftShadowMap), canvas/Lighting.tsx (hemisphere+ambient fill),
  canvas/Poster.tsx. ui/ControlPanel.tsx (accessible stub; ~4Hz setInterval label refresh, NOT a RAF).
- REMOVED: scroll/ dir, canvas/MorphingForm.tsx, canvas/CameraRig.tsx (moved to camera/),
  ui/Overlay.tsx. package.json: removed lenis + @gsap/react; kept gsap; name=live-city-sim;
  three ^0.184.0, @types/three ^0.184.0 (installs 0.184.1).

Car motion formula (handed to shader engineer; runs both backends):
  d = mod(aPhase + uTime*aSpeed, aLaneLength); pos = aLaneStart + aLaneDir*d; heading=atan2(dir.x,dir.z).
Buildings: instance matrix scales unit box to (w,height,d); positionGeometry.y is 0..1 up the facade.

## Gotchas discovered this build

- tsconfig.node.json (compiles vite.config.ts) needed a fix: vite.config used String.includes ->
  required "lib":["ES2023"]/"target":"ES2023"; and "composite:true" + "noEmit:true" = TS6310 error.
  Fix: drop noEmit, add outDir + tsBuildInfoFile under node_modules/.tmp. tsconfig.json (app) left
  with include:["src"] untouched, so three.js/ stays out of the build.
- vite manualChunks: function form `if (id.includes('/node_modules/three/')) return 'three'` (the
  string `['three']` form does not reliably catch the three/webgpu + three/tsl subpath imports).
  chunkSizeWarningLimit raised to 1500 (three chunk ~1.38MB / 373KB gzip).
- instancedBufferAttribute(array|BufferAttribute) is the TSL accessor; attach InstancedBufferAttribute
  to the geometry under a named key, read with attribute('name','type') or instancedBufferAttribute(attr).
- StaticDrawUsage literal = 35044 (used .setUsage on instanced attrs without importing the constant).
- Verified live from installed pkgs: three/tsl exports instancedBufferAttribute, attribute, range,
  positionGeometry, normalWorld, mx_fractal_noise_float, mod, select, etc.; three/webgpu exports
  WebGPURenderer, MeshStandardNodeMaterial, MeshPhysicalNodeMaterial, PostProcessing.
- jsm/objects/SkyMesh.js (export class SkyMesh) exists in r184 for the procedural sky tip.

## Build/verify

- `npm install` then `npm run build` (= `tsc -b && vite build`) must pass before finishing.
- Last green build (2026-06-11): 69 modules, dist/three ~1381KB (gzip 373KB), app ~370KB (gzip 117KB).
