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
  <ScrollProgressDriver progress/>     scroll/ScrollProgressDriver.tsx (ScrollTrigger -> ref)     [motion]
  <div class="canvas-fixed" aria-hidden>
    <Stage>                            canvas/Stage.tsx          (Canvas WebGPU async + extend)   [architect]
      <Scene scrollProgress reduced/>  canvas/Scene.tsx          (lights + rig + form)            [architect]
        <CameraRig scrollProgress/>    canvas/CameraRig.tsx      (camera from scroll)             [motion]
        <MorphingForm scrollProgress/> canvas/MorphingForm.tsx   (TSL displacement + uniforms)    [shader + motion]
    </Stage>  (Poster fallback)        canvas/Poster.tsx         (no-WebGL poster)                [architect/ui]
  </div>
  <main>                               DOM overlay (scrollable)
    <Overlay scrollProgress reduced/>  ui/Overlay.tsx            (Motion UI + parallax + a11y)    [ui]
    <section id="scene-track"/>        the tall scroll track that generates progress             [architect]
  </main>
</SmoothScroll>
```

## The component contract

### Scroll progress
- Carried by a single ref: `React.MutableRefObject<number>`, value in `[0, 1]`.
- Created in `App.tsx` as `const scrollProgress = useRef(0)`.
- Written by `ScrollProgressDriver` (a `ScrollTrigger` with `scrub`, `onUpdate`).
- Read in `useFrame` by `MorphingForm` and `CameraRig`.
- Rule: never store scroll progress in React state. No per-frame re-renders.

### Pointer
- Read from `useThree((s) => s.pointer)` inside `useFrame`. R3F unifies mouse and touch into
  `[-1, 1]` on x and y, center `(0, 0)`. No separate touch code for the canvas-level effect.

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
| `uPointer` | vec3 | xy in -1..1 | local bulge toward cursor/touch | motion (damp of state.pointer) |
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
