# ARCHITECTURE.md

Source of truth for this project. The `r3f-scene-architect` writes it; every other agent reads it
before working so the pieces compose. Keep it current when the contract changes.

Project: a scroll-driven and pointer/touch-driven 3D hero. A form morphs from two eased signals
(scroll progress and pointer position); a DOM overlay animates in sync above the canvas.

## Stack (pinned roles)

- Three.js r171+ via `three/webgpu` (WebGPU first, automatic WebGL2 fallback). `Canvas` `gl` prop
  is an async factory calling `await renderer.init()`.
- React Three Fiber v9 on React 19.
- TSL (`three/tsl`) for node materials. No raw GLSL unless documented.
- Lenis smooth scroll, driven by `gsap.ticker` (single RAF source).
- GSAP 3.13+ (all plugins free) with `@gsap/react` `useGSAP` + ScrollTrigger.
- Motion (`motion/react`) for the DOM overlay only.
- 3D object motion via `useFrame` + `MathUtils.damp`. `framer-motion-3d` is banned (discontinued,
  breaks React 19).

## Layout and ownership

```
<SmoothScroll>                         scroll/SmoothScroll.tsx   (ReactLenis + gsap.ticker sync)  [architect]
  <PreloaderProgress expectsCanvas/>   registry/01-…             (reads lib/loadProgress store)   [ui]
  <div class="canvas-layer" aria-hidden>
    Suspense → lazy(CanvasLayer)       canvas/CanvasLayer.tsx    (THE lazy boundary — see below)  [architect]
      <LoadProgressBridge/>            canvas/LoadProgressBridge (drei useProgress → store)       [architect]
      <GradientLookPanel/>             canvas/GradientLookPanel  (Leva, DEV only)                 [ui]
      <Stage>                          canvas/Stage.tsx          (Canvas WebGPU async + extend)   [architect]
        <Scene reduced detail …/>      canvas/Scene.tsx          (lights + director + form)       [architect]
          <CameraDirector/>            canvas/CameraDirector.tsx (progressMap → sceneTargets)     [motion]
          <MorphingForm/>              canvas/MorphingForm.tsx   (TSL displacement + uniforms)    [shader + motion]
          <GradientBackdrop/>          canvas/GradientBackdrop   (damps toward sceneTargets)      [shader + motion]
    (Poster fallback)                  canvas/Poster.tsx         (no-WebGL poster, no deps)       [architect/ui]
  </div>
  <main>                               DOM: 8 blueprint sections, each writes ONE progress channel
</SmoothScroll>
```

### The lazy boundary (non-negotiable rule 9)

`App` imports the 3D layer with `lazy(() => import('./canvas/CanvasLayer'))`. Everything that
imports `three`, `@react-three/fiber` or `drei` must live on the canvas side of that boundary.

A DOM component that imports drei — even just `useProgress` — makes `three` reachable from the
entry's STATIC graph, and Rolldown then emits the three chunk as a `<link rel="modulepreload">`:
the code-split still shows up in the build log but nothing is actually deferred. Measured on this
kit: 599 KB gzip on first paint before, 157 KB after.

The DOM reads canvas state through `src/lib/loadProgress.ts`, a store with **no imports**. Keep it
that way. Poster and `lib/webgl.ts` are dependency-free for the same reason.

## The component contract

### Scroll progress — the progress map
- `src/scroll/progressMap.ts` holds one channel per section, each `0..1`. Ref-like, never React state.
- Each DOM blueprint writes ONLY its own channel via `useSectionProgress(id, ref)`.
- Pinned sections (05, 11) create their own `ScrollTrigger` with `pin` and write the channel from
  its `onUpdate`: two triggers on one element with different geometries would disagree.
- The single consumer is `CameraDirector`, which turns the map into `sceneTargets`; materials damp
  their uniforms toward those targets. Two levels, one writer each.
- **The order of the union type is the order on the page.** The director hands off between
  consecutive chapters assuming that when section N is > 0, N-1 is already 1. Move a section in the
  DOM → move it in `progressMap.ts` and in the director too.

### Look parameters (non-negotiable rule 10)
Aesthetic constants live in `looks/<section>.json` and reach the shader as uniforms, so the Leva
panel can move them at runtime. No number that is tuned by eye stays in the source.

### Pointer
- Read from the shared `usePointerSignal()` (`src/lib/pointerRef.ts`) inside `useFrame` —
  NDC `[-1, 1]` on x and y, center `(0, 0)`, one passive window-level `pointermove` listener
  for the whole scene.
- **Not** `useThree((s) => s.pointer)`: the DOM overlay (`.content`, z-index 1) covers the
  fixed canvas, so pointer events never reach the canvas element and R3F's `state.pointer`
  stays at `(0, 0)` (verified with `document.elementFromPoint`). We deliberately do NOT use
  `eventSource`/`eventPrefix` on the Canvas either — R3F may set `touch-action: none` on the
  event source, which can break touch scrolling.

### Reduced motion
- `useReducedMotion()` returns a boolean, passed to `Scene` and `Overlay`.
- When true: `MorphingForm` amplitude eases toward ~0 and ignores pointer; `CameraRig` stays calm;
  `Overlay` drops non-essential motion. Content stays fully readable and operable.

### Quality tier
- `useQualityTier()` returns `'low' | 'medium' | 'high'` from viewport, pointer coarseness, and
  device memory. Drives geometry detail, displacement amplitude cap, and (later) particle count.

### Shader uniforms exposed by MorphingForm (owned by shader engineer, driven by motion engineer)
| Uniform | Type | Range | Meaning | Driven by |
|---|---|---|---|---|
| `uScroll` | float | 0..1 | global morph amount (scroll) | motion (damp of scrollProgress) |
| `uPointer` | vec3 | xy in -1..1 | local bulge toward cursor/touch | motion (damp of the shared `pointerSignal`) |
| `uAmplitude` | float | 0..~0.6 | max displacement, set from quality tier | architect/shader (constant per tier) |

Rule: the shader engineer creates and documents these uniforms; the motion engineer drives them in
`useFrame`. Exactly one owner per uniform.

## Single loop

`SmoothScroll` creates Lenis with `autoRaf: false`, registers `lenis.on('scroll', ScrollTrigger.update)`,
adds `gsap.ticker.add((t) => lenis.raf(t * 1000))`, and `gsap.ticker.lagSmoothing(0)`. There is no other
`requestAnimationFrame` touching scroll-linked state.

## Fallback strategy

- `supportsWebGL()` (lib/webgl.ts) gates Canvas vs `Poster`. If neither WebGL2 nor WebGL exists,
  render `Poster` instead of `Stage`.
- An error boundary around `Stage` also falls back to `Poster` on a runtime renderer failure.
- The `WebGPURenderer.init()` itself falls back to WebGL2 when WebGPU is unavailable, so the same TSL
  materials run on both backends. Only WebGPU-only features (compute) need an explicit
  `renderer.isWebGPURenderer` branch (none in this starter; an extension point for the shader engineer).

## Extension points (what each agent does next)

- shader engineer: enrich `MorphingForm`'s TSL graph (fractal noise layers, chromatic shift,
  emissive response), optionally add a WebGPU compute particle field with a WebGL2 instanced fallback.
- motion engineer: build a richer scrubbed `ScrollTrigger` timeline / pinned sections; tune damping
  per device; optionally move the camera on a multi-stop path.
- ui engineer: design the real overlay (sections, nav, CTA), responsive + touch, full a11y pass.
- perf auditor: run the read-only audit against references/performance-and-fallback.md before ship.

## Definition of done

Runs at the frame budget on a throttled mid-tier mobile profile; WebGPU and WebGL2 paths work; a
no-WebGL poster exists; `prefers-reduced-motion` respected; one loop; one owner per property; no
`framer-motion-3d`; no browser storage in the canvas layer.
