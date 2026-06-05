---
name: web3d-integration-patterns
description: >
  Meta-skill (June 2026) for building modern, scroll-driven and pointer-driven 3D
  websites where the geometry and the interface morph as the user scrolls or touches
  the screen. Covers the current stack: Three.js r171+ with the WebGPURenderer and TSL
  (Three Shading Language), React Three Fiber v9 on React 19, GSAP 3.13+ (now fully free,
  all plugins) with ScrollTrigger/ScrollSmoother, Lenis smooth scroll, Motion (motion/react)
  for DOM UI, and @react-spring/three for physics. Use it to choose an architecture, wire the
  libraries together without conflicts, drive mesh deformation from scroll progress and pointer
  position, keep the experience accessible (prefers-reduced-motion) and ship a mobile-safe
  performance budget with automatic WebGL2 fallback. Trigger phrases (IT): "sito 3D",
  "esperienza 3D allo scroll", "movimentazione della forma", "deformazione mesh al mouse",
  "shader al tocco", "interfaccia 3D reattiva", "WebGPU", "TSL", "React Three Fiber",
  "scroll cinematografico". Trigger phrases (EN): "scroll-driven 3D", "pointer-reactive mesh",
  "WebGPU site", "interactive 3D landing", "shader distortion on scroll".
---

# Web 3D Integration Patterns (June 2026 edition)

## Why this skill exists

This is a **meta-skill**: it does not re-teach Three.js or GSAP from zero, it decides *how to combine* the current libraries into one coherent, performant, accessible 3D website, and it tells the specialized sub-agents in `.claude/agents/` what to build and in what order.

The defining use case it is tuned for: a modern site where **the 3D form and the interface deform and react as the user scrolls (desktop) or touches the screen (mobile)**. Concretely this means vertex displacement / distortion shaders driven by scroll progress and pointer position, camera moves tied to a smooth-scroll loop, and a DOM UI layer that animates in sync without fighting the 3D layer.

## What changed since the previous (2025) version

Read this first. Several patterns from the old skill are now wrong.

1. **WebGPU is the default target, not an experiment.** Three.js exposes a zero-config renderer at `three/webgpu`. It ships WGSL under the hood and falls back to WebGL2 automatically, so you adopt it without breaking older browsers. Start new projects on WebGPU.
2. **Shaders are written in TSL, not raw GLSL strings.** TSL (`three/tsl`) is a node-based, renderer-agnostic shading language. The same TSL graph compiles to WGSL (WebGPU) and GLSL (WebGL2). Hand-written GLSL string materials are now the fallback path, not the primary one.
3. **React Three Fiber is v9 on React 19.** The `gl` prop accepts an **async factory** (returns a Promise) so the `WebGPURenderer` can `await renderer.init()`. `state.gl` is now `state.renderer`. There is a new scheduler for `useFrame`.
4. **`framer-motion-3d` is dead.** It is discontinued and does not support React 19. Do **not** import `motion` from `framer-motion-3d` and do **not** use `motion.mesh`. Animate 3D objects with `useFrame` (manual `damp`/`lerp`), `@react-spring/three`, or GSAP. Use **Motion (`motion/react`)** only for the DOM UI overlay.
5. **GSAP is 100% free, all plugins included.** ScrollTrigger, ScrollSmoother, SplitText, MorphSVG, DrawSVG, Observer, Flip, Inertia, Physics2D: all free, including commercial use. Use `@gsap/react` and its `useGSAP()` hook in React (it handles cleanup). No more Club GSAP tokens.
6. **Lenis is the smooth-scroll standard** and the synchronization point: one RAF loop drives Lenis, ScrollTrigger, and the R3F render. Do not run two competing scroll/animation loops.

## The current stack (pin these roles, not exact patch numbers)

| Layer | Library | Role | Notes |
|---|---|---|---|
| Renderer | `three` / `three/webgpu` (r171+) | WebGPU first, WebGL2 fallback | Use the latest stable release; check `three` version in the project rather than hard-coding a release number |
| Shaders | `three/tsl` | Node-based materials, vertex displacement, compute | Renderer-agnostic, compiles to WGSL + GLSL |
| React layer | `@react-three/fiber` v9 (React 19) | Declarative scene graph | `gl` async factory for WebGPU; `state.renderer` |
| Helpers | `@react-three/drei` | Loaders, controls, `Environment`, `useTexture`, `Html` | High-level R3F helpers |
| Post FX | `@react-three/postprocessing` (pmndrs/postprocessing) | Bloom, DOF, chromatic aberration | Some effects need WebGPU/TSL variants |
| Physics | `@react-three/rapier` (+ `ecctrl` for character control) | Rigid bodies, colliders as JSX | Only if the brief needs real physics |
| Scroll engine | `lenis` (darkroom.engineering) | Smooth scroll, single RAF source | First-class React adapter `lenis/react` |
| Scroll/timeline anim | `gsap` 3.13+ + `@gsap/react` + ScrollTrigger/ScrollSmoother | Scrubbed sequences, pinning, text reveals | The driver for scroll-linked 3D and marketing sections |
| 3D motion | `useFrame` / `@react-spring/three` / GSAP | Object animation, gestures, springs | NOT framer-motion-3d |
| DOM UI motion | `motion` (`motion/react`) | Overlay micro-interactions, layout, exit transitions | DOM only, never the canvas |

## Decision matrix: which combination for which brief

| Brief | Recommended stack | Rationale |
|---|---|---|
| Marketing landing, scroll is the narrative, heavy hero 3D | R3F v9 + TSL + GSAP ScrollTrigger + Lenis, Motion for DOM | GSAP owns scroll orchestration; Lenis gives the cinematic feel; TSL drives the morph |
| Pointer-reactive hero (mesh follows / distorts toward cursor and touch) | R3F v9 + TSL displacement driven by a pointer uniform, `useFrame` damping | Pointer is a per-frame signal, best read in `useFrame`, smoothed with `MathUtils.damp` |
| Product configurator / interactive viewer | R3F v9 + drei + `@react-spring/three` | State-driven, component-based, springs feel natural on gestures |
| Particle field / fluid / 100k+ instances | TSL **compute** shaders + instancing | Compute pipeline is the 10-100x win; keep it off the CPU |
| Physics playground (drag, momentum, collisions) | R3F v9 + `@react-three/rapier` + `ecctrl` | Mature physics ecosystem as JSX |
| Simple appear/scale UI only, no real 3D | Native CSS scroll-driven animations or Motion | Do not pull in Three.js for what CSS can do |

## Core integration patterns

### Pattern A: the single render loop (Lenis + GSAP + R3F)

The most important rule of the whole stack: **one loop**. Lenis produces the scroll value, GSAP's ticker advances Lenis, ScrollTrigger updates from Lenis, and R3F reads the resulting scroll progress inside `useFrame`. Never start an independent `requestAnimationFrame` that also mutates the same objects.

```js
// scroll/loop.js
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export function initSmoothScroll() {
  const lenis = new Lenis({ autoRaf: false }) // we drive RAF from gsap.ticker
  lenis.on('scroll', ScrollTrigger.update)
  gsap.ticker.add((time) => lenis.raf(time * 1000)) // gsap time is in seconds
  gsap.ticker.lagSmoothing(0)
  return lenis
}
```

In React, prefer the official adapter and the `useGSAP` hook so cleanup is automatic:

```jsx
// App.jsx
import { ReactLenis } from 'lenis/react'

export default function App() {
  return (
    <ReactLenis root options={{ lerp: 0.1, smoothWheel: true }}>
      {/* Canvas + DOM overlay live here */}
    </ReactLenis>
  )
}
```

### Pattern B: WebGPU + TSL inside R3F v9

The renderer needs async init, so the `gl` prop returns a Promise. Import the WebGPU build of Three and TSL, and `extend` so JSX recognizes node materials.

```jsx
// canvas/Stage.jsx
import * as THREE from 'three/webgpu'
import { Canvas, extend } from '@react-three/fiber'

extend(THREE) // makes WebGPU primitives + node materials available as JSX

export function Stage({ children }) {
  return (
    <Canvas
      gl={async (props) => {
        const renderer = new THREE.WebGPURenderer({ ...props, antialias: true })
        await renderer.init() // REQUIRED for WebGPU; falls back to WebGL2 if unsupported
        return renderer
      }}
      camera={{ position: [0, 0, 6], fov: 45 }}
      dpr={[1, 2]}
    >
      {children}
    </Canvas>
  )
}
```

Detect the active backend with `renderer.isWebGPURenderer` (not `gl.capabilities.isWebGL2`, which is undefined on WebGPU).

### Pattern C: scroll-driven AND pointer-driven mesh deformation (the headline feature)

This is the pattern Lorenzo's brief is about. The shape morphs from two independent signals:
- **scroll progress** (`0..1`), a smooth value coming from Lenis,
- **pointer position** (`-1..1` on x and y, unified across mouse and touch), smoothed per frame.

Both are passed into a TSL node material as uniforms; the vertex stage displaces positions and the fragment stage can shift color (RGB shift) for extra life. See `references/scroll-pointer-driven.md` for the full TSL graph and the touch handling. Skeleton:

```jsx
// mesh/MorphingBlob.jsx
import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MathUtils } from 'three'
import { uniform, positionLocal, normalLocal, mx_noise_float, time, vec3 } from 'three/tsl'
import { MeshStandardNodeMaterial } from 'three/webgpu'

export function MorphingBlob({ scrollProgress /* a ref updated by ScrollTrigger */ }) {
  const matRef = useRef()
  const uScroll = useMemo(() => uniform(0), [])
  const uPointer = useMemo(() => uniform(vec3(0, 0, 0)), [])
  const pointer = useThree((s) => s.pointer) // R3F unifies mouse + touch into [-1,1]

  const material = useMemo(() => {
    const m = new MeshStandardNodeMaterial({ roughness: 0.25, metalness: 0.1 })
    const noise = mx_noise_float(positionLocal.mul(1.5).add(time.mul(0.3)))
    const amount = uScroll.mul(0.6).add(uPointer.length().mul(0.4))
    m.positionNode = positionLocal.add(normalLocal.mul(noise).mul(amount))
    return m
  }, [uScroll, uPointer])

  useFrame((_, delta) => {
    // damp the raw signals so the surface eases instead of snapping
    uPointer.value.x = MathUtils.damp(uPointer.value.x, pointer.x, 6, delta)
    uPointer.value.y = MathUtils.damp(uPointer.value.y, pointer.y, 6, delta)
    uScroll.value = MathUtils.damp(uScroll.value, scrollProgress.current, 4, delta)
  })

  return (
    <mesh material={material}>
      <icosahedronGeometry args={[1.4, 128]} />
    </mesh>
  )
}
```

### Pattern D: DOM UI overlay that animates in sync (Motion)

The HTML interface (headings, nav, CTA) lives above the canvas and animates with Motion (`motion/react`). It reads the same scroll progress for parallax, but it never touches Three objects.

```jsx
import { motion } from 'motion/react'

export function Hero({ scrollProgress }) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <h1>Form in motion</h1>
    </motion.header>
  )
}
```

## Hard rules (avoid the classic conflicts)

1. **One animation owner per property.** A given object property (position, scale, a uniform) is driven by exactly one of: GSAP, React Spring, or `useFrame`. Mixing two on the same value causes jitter.
2. **One scroll/RAF loop.** Lenis + `gsap.ticker` is the single source. Do not also call `requestAnimationFrame` to move scroll-linked things.
3. **Clean up.** With `@gsap/react`'s `useGSAP`, cleanup is automatic. For manual tweens/ScrollTriggers and Lenis instances, kill them on unmount.
4. **No browser storage in the canvas layer.** Keep transient state in React state / refs.
5. **Respect `prefers-reduced-motion`.** Provide a calm path: stop scrubbed displacement, reduce amplitude, freeze the camera. Accessibility is part of "done", see `references/performance-and-fallback.md`.
6. **Mobile is a first-class target.** Touch pointer, lower DPR cap, fewer lights, instancing. Budget in `references/performance-and-fallback.md`.

## How this skill drives the sub-agents

The main Claude Code session is the orchestrator (sub-agents cannot spawn sub-agents). A typical build delegates in this order:

1. **`r3f-scene-architect`** sets up the project, the `Canvas` with async WebGPU init, the scene graph, camera, lights, environment, and the Lenis + GSAP single-loop wiring.
2. **`tsl-shader-engineer`** writes the TSL node materials: the scroll + pointer displacement, any compute particles, RGB shift, custom easing of the surface.
3. **`scroll-motion-engineer`** binds scroll progress and pointer/touch to the uniforms and the camera, builds the ScrollTrigger timeline, and tunes the damping.
4. **`ui-overlay-a11y-engineer`** builds the DOM overlay with Motion, makes it responsive and touch-friendly, and implements the reduced-motion path and ARIA.
5. **`perf-fallback-auditor`** (read-only) audits draw calls, instancing, on-demand rendering, DPR, the WebGPU to WebGL2 fallback, and the mobile budget, then returns a prioritized report the others apply.

Detailed references live in `references/`:
- `webgpu-tsl.md`: WebGPU + TSL + R3F v9 setup, node materials, compute shaders, backend detection, fallback.
- `scroll-pointer-driven.md`: the full scroll + pointer + touch deformation pattern, Lenis/ScrollTrigger sync, raycasting, parallax.
- `performance-and-fallback.md`: performance budget, instancing, on-demand rendering, DPR, mobile, prefers-reduced-motion, graceful degradation.
