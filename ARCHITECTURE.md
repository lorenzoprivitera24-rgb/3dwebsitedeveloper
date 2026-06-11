# ARCHITECTURE.md — Live City Simulator

Source of truth for this project. The `r3f-scene-architect` writes it; every other agent reads it
before working so the pieces compose. Keep it current when the contract changes.

**Project (decided 2026-06-11, supersedes the original scroll-morph hero):** a fullscreen, realistic
**live city simulator**. A seeded procedural city (instanced buildings, roads, sidewalks) runs a
continuous day/night simulation that drives the sun, sky, fog, and (via the shader engineer) window
lights, street lamps, and car headlights. Traffic moves along road lanes. A DOM control panel scrubs
time, pause/speed, traffic density, and quality. No page scroll.

## Chosen stack row (from the skill's decision matrix)

Closest match: **"Particle field / many instances → instancing (+ optional TSL compute)"**, combined
with **"configurator → state-driven"** for the panel. There is **no scroll narrative**, so GSAP
ScrollTrigger / ScrollSmoother and Lenis are **not used**. Renderer: `three/webgpu` (WebGPU first,
auto WebGL2 fallback). Shaders: TSL. React: R3F v9 on React 19. DOM UI motion: Motion (`motion/react`),
DOM only. 3D motion: `useFrame` + `MathUtils.damp`.

## Adapted non-negotiable: the single per-frame loop (CLAUDE.md rule 3)

CLAUDE.md rule 3 ("Lenis + gsap.ticker is the single RAF source") is **adapted** because there is no
scroll: **R3F's internal frame loop (`useFrame`) is the single per-frame driver.** Lenis is removed.
GSAP is kept in `package.json` **only for one-shot tweens on values nothing else drives per frame**
(e.g. a camera fly-to, or tweening `dayPhase` on a scrub). GSAP must **never** co-drive a uniform,
the camera, or any transform that a `useFrame` also writes in the same frame. All other CLAUDE.md
non-negotiables still apply verbatim: no `framer-motion-3d`; **one owner per property**; damp every
input signal; `dpr` capped at 2; quality tiers; a11y incl. `prefers-reduced-motion`; no browser
storage in the canvas layer.

**Per-frame owners (the whole app):**
- **Sim time + sun + sky/fog + shared uniforms** → `sim/SimClockDriver.tsx` (one `useFrame`).
- **Camera transform** → `camera/CameraRig.tsx` (one `useFrame`).
- **Traffic motion** → the car material's `positionNode` in TSL (GPU, no `useFrame`) — shader engineer.
- Nothing else runs a per-frame loop. The control panel uses a low-rate `setInterval` label refresh
  (a UI readout, explicitly **not** an animation loop).

## Component tree + file map (per-agent ownership)

```
App.tsx                                  [architect]  SimClockProvider, quality override state, seed, layout shell
  <SimClockProvider>                     sim/SimClock.tsx          [architect]  clock ref + imperative API (context)
    <div.canvas-layer aria-hidden>       (decorative for AT)
      <Stage dpr fallback=Poster>        canvas/Stage.tsx          [architect]  async WebGPU Canvas, error boundary, frameloop=always
        <Scene seed tier reduced>        canvas/Scene.tsx          [architect]  assembles city + sim + camera; sizes camera/shadows to extent
          <RendererConfig shadows/>      canvas/RendererConfig.tsx [architect]  ACES tone mapping, soft shadow map enable
          <Lighting/>                    canvas/Lighting.tsx       [architect]  hemisphere + low ambient fill (sun is in the driver)
          <SimClockDriver .../>          sim/SimClockDriver.tsx    [architect]  THE time owner: advances clock, drives sun light + uniforms + sky/fog
          <Ground/>                      city/Ground.tsx           [architect→shader]  instanced ground/roads/sidewalks (placeholder mats)
          <Buildings/>                   city/Buildings.tsx        [architect→shader]  3 instanced archetypes + aFacade attr (placeholder mats)
          <Traffic/>                     city/Traffic.tsx          [architect→shader]  instanced cars + lane attrs (placeholder mat; motion in TSL)
          <CameraRig/>                   camera/CameraRig.tsx      [architect→motion]  damped constrained orbit skeleton
      (Poster on no-WebGL / crash)       canvas/Poster.tsx         [architect/ui]  static DOM fallback
    <ControlPanel/>                      ui/ControlPanel.tsx       [architect→ui]  accessible DOM panel; contract proven, restyle freely
```

Supporting modules:
```
city/types.ts            [architect]  the city data contract (plain data; no three.js)
city/generateCity.ts     [architect]  PURE seeded layout generator (mulberry32) -> CityLayout
city/buildCarInstances.ts[architect]  PURE car distribution -> per-instance typed arrays + layout doc
sim/uniforms.ts          [architect→shader]  the SHARED TSL uniforms (single writer = the driver)
sim/sun.ts               [architect]  dayPhase -> sun direction/color/intensity + sky color (pure)
hooks/useQualityTier.ts  [architect]  tier table (grid/cars/shadows/dpr); pickTier + override
hooks/useReducedMotion.ts[architect]  prefers-reduced-motion (live)
lib/webgl.ts             [architect]  any-WebGL detection -> Poster gate
```

## City data contract (`city/types.ts`)

Plain data only, meters, +Y up, ground at Y=0, centered on origin. Consumed by the meshes and by the
shader/motion engineers. Key shapes (see the file for full JSDoc):

- `BuildingInstance` — `archetype` (`'lowrise'|'midrise'|'tower'`), `position` (footprint center, y=0),
  `footprint` (w,d), `height`, `facadeSeed` (0..1), `litBias` (0..1).
- `GroundQuad` — `position` (center, y carries a tiny layer offset), `size` (w,d). Used for ground,
  roads, sidewalks.
- `Lane` — `id`, `waypoints` (ordered `[x,y,z]`, travel from first→last, at car-deck height), `length`.
- `CityLayout` — `seed`, `extent` (half-size), `ground`, `buildings[]`, `roads[]`, `sidewalks[]`,
  `lanes[]`, `counts`.

`generateCity(seed, gridSize)` is deterministic. World constants exported as `CITY_CONSTANTS`
(BLOCK_SIZE 40, ROAD_WIDTH 12, SIDEWALK_WIDTH 3, CELL 52, CAR_DECK_Y 0.4).

## Uniforms contract (the shader engineer reads; the architect's driver writes)

All in `sim/uniforms.ts` as a **single shared `simUniforms` object** created once. Import THOSE node
objects (do not create copies). **The shader engineer must only READ these in node graphs; the
`SimClockDriver` is the sole writer.**

| Uniform | Type | Range / meaning | Written by |
|---|---|---|---|
| `uTime` | float | monotonic sim seconds (animation phase: traffic, flicker) | SimClockDriver |
| `uDayPhase` | float | 0..1 time of day (0 midnight, 0.25 sunrise, 0.5 noon, 0.75 sunset) | SimClockDriver |
| `uDaylight` | float | 0..1 smooth night→day (window-light fade, fog) | SimClockDriver |
| `uSunDirection` | vec3 | unit vector scene→sun (lighting, sky, fog tint) | SimClockDriver |

Per-instance vertex attributes already attached to the instanced geometries (read with
`instancedBufferAttribute(theAttr)` or `attribute('name','type')`):

- **Buildings** (`city/Buildings.tsx`): `aFacade` = **vec2** `[facadeSeed (0..1), litBias (0..1)]`.
  Suggested use: hash `facadeSeed` into a window grid + tint; multiply night emissive by `litBias`
  and `uDaylight.oneMinus()`. The instance matrix already scales the unit box to (w, height, d), so
  `positionGeometry.y` in 0..1 maps up the facade — convenient for floor banding.
  **Shader note (implemented):** the facade material derives the window grid in WORLD space
  (`positionWorld`, meters) rather than object space, because the InstancedMesh path bakes the
  per-instance matrix into `positionLocal`, leaving mesh-level `modelScale` at identity (so it can
  NOT report a building's real size). World space gives meter-accurate, size-independent cells.
- **Cars** (`city/Traffic.tsx` via `city/buildCarInstances.ts`):
  `aLaneStart` vec3, `aLaneDir` vec3 (unit), `aLaneLength` float, `aPhase` float (start offset, m),
  `aSpeed` float (m/s), `aCar` vec2 `[colorSeed, sizeSeed]`.
  **Shader note (implemented):** car instance matrices are set to **identity**; the material's
  `positionNode` owns the full transform (lane motion + heading + per-car scale) built from
  `positionGeometry` (the raw unit box), so there is no double transform with the instance matrix.
- **Roads** (`city/Ground.tsx`, ADDED by shader engineer): `aQuad` = **vec2** `[sizeX, sizeZ]`, the
  road strip's world footprint. The asphalt material uses it to find the run-axis (longer dimension)
  and short width so it can draw a centred dashed lane line along the road in real meters. Only the
  roads InstancedMesh carries it (sidewalks/ground do not need it). Local to Ground.tsx; touches no
  shared uniform.

## Lane / traffic motion contract (shader engineer implements in TSL)

Cars are an `InstancedMesh` of box bodies (one draw call). Motion is **computed in-shader from
`uTime` + the per-instance attributes**, so it runs on **both WebGPU and WebGL2** (this is the brief's
requirement, and matches r184 `examples/webgpu_instance_path.html`). Reference formula:

```
d   = mod(aPhase + uTime * aSpeed, aLaneLength)   // signed distance along the lane
pos = aLaneStart + aLaneDir * d                   // world position of the car
heading = atan2(aLaneDir.x, aLaneDir.z)           // orient body + headlights
```

Set the car material's `positionNode` to place the box at `pos` (offset by the local vertex), rotate
the body to `heading`, `colorNode` from `aCar.x`, and add emissive head/tail lights gated by
`uDaylight`. The placeholder material currently parks each car statically at its lane start; replacing
`positionNode` overrides that each frame. Leave the geometry + attribute wiring intact.

**Optional WebGPU-only enhancement (extension point):** gate on `renderer.isWebGPURenderer`. Run a
compute pass that adjusts each car's effective `aPhase`/`aSpeed` for follow-distance/braking, writing
to an `instancedArray`, then feed that into the same `pos` formula. WebGL2 keeps the constant-speed
path. Do not change the attribute layout when adding this.

## Camera rig contract (motion engineer tunes)

`camera/CameraRig.tsx` is a hand-rolled **damped constrained orbit** (no drei — see below). It is the
**single owner of the camera transform**. It integrates a target spherical `(radius, theta, phi)` from
pointer drag + wheel zoom, then damps the camera toward it each frame. **Constraints that must be
preserved:** `radius ∈ [minDistance, maxDistance]`; `phi ∈ [minPolar, maxPolar]` with
`maxPolar < π/2` so the camera **never reaches or goes below the ground plane**. Config (distances,
polar limits, target) is derived from `city.extent` in `Scene.tsx` so it scales with the tier.

Motion engineer owns the **feel**: damping rates, drag/zoom sensitivity, pointer-parallax amount, idle
cinematic-drift amplitude/period, optional inertia, optional GSAP one-shot fly-to (hand control back
to the rig afterward; never co-drive). `touch-action: none` is set on the canvas so the rig owns touch.

### Why no drei

A hand-rolled rig keeps **one-owner-per-property** clean (drei's `OrbitControls` writes its own camera
state and can fight a `useFrame`), avoids any browser storage, keeps the dependency surface small, and
lets the motion engineer own all tuning in one place. drei can be added later if a specific helper is
genuinely needed; it is intentionally **not** a dependency yet.

## Control panel contract (UI agent owns the final design)

`ui/ControlPanel.tsx` is a **functional, accessible stub** that proves the contract. Every control maps
to a `SimClockApi` call (`sim/SimClock.tsx`) or the quality-override setter. Restyle/enrich freely; keep
the wiring.

- **Play/Pause** → `clock.togglePaused()` / `setPaused(bool)`.
- **Time-of-day slider** (0..1) → `clock.setDayPhase(p)` (re-bases sim time; the scrub is authoritative).
- **Speed** → `clock.setSpeed(multiplier)`.
- **Day length** (optional) → `clock.setSecondsPerDay(s)` (default 120s ≈ 2 real minutes/day).
- **Quality override** → `onQualityOverride('low'|'medium'|'high'|null)`; `null` = auto. Changing it
  **remounts the Scene** (App keys the Scene on `seed-tier`) because grid/car counts are baked at
  generation time.
- **Traffic density** (to add) → expose a setter App passes to `Scene → Traffic` to rebuild car
  instances at a new count; remount via key like quality.

**No extra RAF rule for the panel:** to display the auto-advancing clock the panel polls
`clock.get()` at ~4 Hz via `setInterval` (a label refresh, paused while the slider is dragged). It must
**not** start a `requestAnimationFrame`. Sim state lives in the clock ref (no per-frame React renders);
the panel mirrors only what it needs into local React state. **No browser storage.**

## Quality tiers (`hooks/useQualityTier.ts`)

`pickTier()` from viewport width + `(pointer: coarse)` + `deviceMemory`. The panel can override.

| Tier | gridSize | buildings (~) | carCount | shadows | shadowMapSize | buildingSegments | dpr |
|---|---|---|---|---|---|---|---|
| low (touch/small/≤2GB) | 6 | ~30–70 | 60 | off | 1024 | 1 | [1, 1.5] |
| medium (≤1280px/≤4GB) | 9 | ~80–160 | 160 | on | 2048 | 1 | [1, 2] |
| high (desktop+GPU) | 12 | ~150–290 | 320 | on | 4096 | 2 | [1, 2] |

Building count is approximate (per-block subdivision + gaps are seeded). dpr is **never** uncapped;
hard ceiling 2. Everything that scales with capability reads this one table.

## Reduced motion (`prefers-reduced-motion`)

When reduced is true: the **day/night cycle is frozen** (`advanceClock` no-ops, so `uTime` and
`uDayPhase` hold → traffic and flicker also freeze, by design); the **camera idle drift + pointer
parallax are disabled** and the orbit damping is stiffened (calmer). **Manual control stays fully
operable** — the user can still scrub time, pause/play, and orbit by dragging. No content is hidden
behind motion. The canvas wrapper is `aria-hidden`; all real controls are accessible DOM in the panel.

## Fallback strategy

- `supportsWebGL()` (any WebGL2/WebGL context) gates `<Stage>` vs `<Poster>`. No context → Poster.
- An error boundary around the Canvas falls back to `<Poster>` on a runtime renderer crash.
- `WebGPURenderer.init()` falls back to WebGL2 automatically; the same TSL materials run on both, so
  only WebGPU-**only** features need an `renderer.isWebGPURenderer` branch (the optional traffic
  compute pass is the one extension point).

## Extension points (what each agent does next)

- **shader engineer** — DONE: procedural PBR materials replace all placeholders. Files live in
  `city/shaders/` (`tslHelpers.ts` shared hash/value-noise; `trafficMaterial.ts`; `buildingMaterial.ts`;
  `groundMaterials.ts`) plus `city/Sky.tsx`. Facades = world-space window grid + progressive dusk
  window lighting from `aFacade` + `uDaylight`; roads = asphalt + dashed lane markings (via `aQuad`);
  sidewalk + ground concrete; cars = in-shader lane motion + heading + night head/tail lights.
  Sky = an owned origin-centred dome (NOT SkyMesh, NOT `scene.backgroundNode`) reading
  `uSunDirection`/`uDaylight`/`uDayPhase`, with sun glow + hash stars; it draws in front of the
  driver's flat `scene.background` and is excluded from fog, so the driver's single-writer contract
  is untouched. Still-open optional: bloom post for night glow; WebGPU compute for traffic spacing.
  **Material-local uniform exposed for the motion engineer:** `trafficMaterial.ts` returns
  `uSpeedScale` (float, default 1) — a global traffic speed multiplier. It is material-owned, NOT a
  shared sim uniform; the deterministic lane formula is preserved (uSpeedScale just scales `aSpeed`).
  Currently no one drives it; the motion engineer MAY, per tier. **Tone-mapping exposure breathing was
  deliberately NOT claimed** — `RendererConfig.toneMappingExposure` remains a constant owned by the
  architect; left available if desired later.
- **motion engineer** — tune the camera rig feel (damping, parallax, idle drift, zoom limits, optional
  fly-to). Tune per-tier traffic speed if desired. Owns no uniforms the driver writes.
- **ui engineer** — design the real control panel (layout, theming, traffic-density slider, maybe a
  seed control), full responsive + touch + a11y pass; keep the documented wiring.
- **perf auditor** — read-only audit against `references/performance-and-fallback.md`: draw-call count
  per tier, shadow cost, dpr, WebGPU→WebGL2 fallback, reduced-motion, the no-WebGL poster, a11y.
- **pedestrians (stretch, high tier only)** — NOT built. Extension point lives in `Scene.tsx`: an
  instanced low-poly pedestrian mesh on sidewalk-derived walk paths, animated in TSL like Traffic,
  gated behind `tier.tier === 'high'`.

## Definition of done

Runs at the frame budget on a throttled mid-tier mobile profile; WebGPU and WebGL2 paths work; a
no-WebGL poster exists; `prefers-reduced-motion` respected; **one per-frame loop** (R3F `useFrame`),
**one owner per property**; no `framer-motion-3d`; no browser storage in the canvas layer.
