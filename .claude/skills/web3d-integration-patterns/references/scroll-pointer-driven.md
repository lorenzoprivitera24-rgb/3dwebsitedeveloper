# Scroll-driven and pointer-driven 3D (June 2026)

This is the heart of the brief: the geometry and interface **morph as the user scrolls (desktop) and as they touch the screen (mobile)**. Two independent signals feed the deformation:

- **scroll progress** `0..1`, a smooth value from Lenis,
- **pointer** `(-1..1, -1..1)`, unified across mouse and touch by R3F.

Both are eased per frame and pushed into TSL uniforms.

## 1. The single loop (recap, this is non-negotiable)

```js
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
gsap.registerPlugin(ScrollTrigger)

export function initLoop() {
  const lenis = new Lenis({ lerp: 0.1, smoothWheel: true, autoRaf: false })
  lenis.on('scroll', ScrollTrigger.update)
  gsap.ticker.add((t) => lenis.raf(t * 1000))
  gsap.ticker.lagSmoothing(0)
  return lenis
}
```

In React use the adapter and `useGSAP` so teardown is automatic:

```tsx
import { ReactLenis, useLenis } from 'lenis/react'
import { useGSAP } from '@gsap/react'
```

## 2. Capturing scroll progress without re-rendering React every frame

Do **not** put scroll progress in React state (it would re-render 60+ times/second). Keep it in a ref and let `useFrame` read it.

```tsx
import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

export function useScrollProgress(targetSelector: string) {
  const progress = useRef(0)
  useGSAP(() => {
    const st = ScrollTrigger.create({
      trigger: targetSelector,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      onUpdate: (self) => { progress.current = self.progress },
    })
    return () => st.kill()
  }, [targetSelector])
  return progress // pass this ref down to the mesh
}
```

## 3. Unified pointer + touch

R3F normalizes mouse and touch into `state.pointer` as `[-1, 1]` on both axes, with `(0,0)` at the center. This works on phones out of the box. Read it inside `useFrame`:

```tsx
const pointer = useThree((s) => s.pointer) // {x: -1..1, y: -1..1}
```

If you need pointer data on a specific mesh (not the whole canvas), use the event payload:

```tsx
<mesh
  onPointerMove={(e) => {
    // e.uv -> hit UV (0..1), e.point -> world hit position
    uHit.value.copy(e.uv ?? uHit.value)
  }}
  onPointerOut={() => { /* relax the effect */ }}
/>
```

For a cursor-follow effect that also reads on touch-drag, the canvas-level `state.pointer` is usually enough and cheaper than raycasting every frame.

## 4. Easing the raw signals (the secret to a premium feel)

Raw scroll and pointer values are jumpy. Ease them every frame with `MathUtils.damp` (framerate-independent) before writing the uniform. Higher lambda = snappier, lower = floatier.

```tsx
import { MathUtils } from 'three'

useFrame((_, delta) => {
  // pointer: snappy enough to feel responsive
  uPointer.value.x = MathUtils.damp(uPointer.value.x, pointer.x, 6, delta)
  uPointer.value.y = MathUtils.damp(uPointer.value.y, pointer.y, 6, delta)
  // scroll: floatier so the morph reads as a transition, not a twitch
  uScroll.value = MathUtils.damp(uScroll.value, progress.current, 4, delta)
})
```

## 5. The full morphing mesh component

```tsx
import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MathUtils } from 'three'
import { MeshStandardNodeMaterial } from 'three/webgpu'
import {
  uniform, positionLocal, normalLocal, mx_fractal_noise_float, time, vec3, float,
} from 'three/tsl'

type Props = { scrollProgress: React.MutableRefObject<number> }

export function MorphingForm({ scrollProgress }: Props) {
  const pointer = useThree((s) => s.pointer)

  const { material, uScroll, uPointer, uShift } = useMemo(() => {
    const uScroll = uniform(0)
    const uPointer = uniform(vec3(0, 0, 0))
    const uShift = uniform(0)

    const m = new MeshStandardNodeMaterial({ roughness: 0.22, metalness: 0.1 })

    // base turbulence animated over time
    const turbulence = mx_fractal_noise_float(
      positionLocal.mul(1.4).add(time.mul(0.2)),
    )
    // pointer adds a directional bulge toward the cursor/touch
    const pointerBulge = positionLocal.xy.sub(uPointer.xy).length().oneMinus().clamp(0, 1)
    // total displacement amplitude: scroll opens the form up, pointer punches it locally
    const amplitude = uScroll.mul(0.55).add(pointerBulge.mul(0.35))

    m.positionNode = positionLocal.add(normalLocal.mul(turbulence).mul(amplitude))
    // subtle emissive that brightens as you scroll
    m.emissiveNode = vec3(0.1, 0.3, 0.9).mul(uScroll.mul(0.4))

    return { material: m, uScroll, uPointer, uShift }
  }, [])

  useFrame((_, delta) => {
    uPointer.value.x = MathUtils.damp(uPointer.value.x, pointer.x, 6, delta)
    uPointer.value.y = MathUtils.damp(uPointer.value.y, pointer.y, 6, delta)
    uScroll.value = MathUtils.damp(uScroll.value, scrollProgress.current, 4, delta)
    uShift.value = uScroll.value * 0.01
  })

  return (
    <mesh material={material}>
      <icosahedronGeometry args={[1.4, 128]} />
    </mesh>
  )
}
```

## 6. Driving the camera from scroll

Tie the camera to scroll progress in `useFrame`, or build an explicit GSAP timeline with `scrub` for choreographed multi-stop moves. Keep one owner: either `useFrame` math OR a GSAP timeline on the camera, not both.

```tsx
// useFrame approach (good for continuous paths)
useFrame((state) => {
  const p = scrollProgress.current
  state.camera.position.z = MathUtils.lerp(6, 2.5, p)
  state.camera.position.y = Math.sin(p * Math.PI) * 1.2
  state.camera.lookAt(0, 0, 0)
})
```

```tsx
// GSAP timeline approach (good for discrete keyframed stops)
useGSAP(() => {
  const tl = gsap.timeline({
    scrollTrigger: { trigger: '#scene', start: 'top top', end: 'bottom bottom', scrub: 1, pin: true },
  })
  tl.to(camera.position, { z: 2.5, y: 1.2, onUpdate: () => camera.lookAt(0, 0, 0) }, 0)
    .to(camera.position, { x: -2, z: 3 }, 0.5)
})
```

## 7. DOM parallax in sync (Motion)

The overlay reads the same scroll value via Motion's `useScroll`/`useTransform` (DOM scroll), so the text drifts with the 3D without touching it.

```tsx
import { motion, useScroll, useTransform } from 'motion/react'

export function ParallaxHeading() {
  const { scrollYProgress } = useScroll()
  const y = useTransform(scrollYProgress, [0, 1], [0, -120])
  return <motion.h1 style={{ y }}>Form in motion</motion.h1>
}
```

Note: Motion's `useScroll` reads native scroll; Lenis wraps native scroll, so the values stay consistent. Keep the 3D layer on the ref-based progress (section 2) and the DOM layer on Motion's `useScroll`; both ultimately track the same Lenis-smoothed scroll.

## 8. Touch and mobile specifics

- `state.pointer` already covers touch-move; no separate touch code needed for the cursor-follow effect.
- Lenis handles touch inertia; keep `smoothTouch` off unless the brief demands it (it can feel laggy on long pages).
- Reduce displacement amplitude and geometry subdivision on small viewports (see performance-and-fallback.md).
- Test with a real device or throttled DevTools; damping lambdas that feel right on desktop often need lowering on mobile.

## 9. Accessibility

Gate the scrubbed motion behind `prefers-reduced-motion`. When reduced motion is requested:
- freeze `uScroll` at a calm value, stop the per-frame pointer damping (set amplitude to ~0),
- keep the content fully readable and navigable without scroll-jacking,
- ensure Lenis does not trap keyboard or anchor navigation (it runs on native scroll, so this works, but verify tab order).

```tsx
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
```

## 10. Checklist for the scroll/motion engineer

- [ ] Scroll progress lives in a ref, not React state
- [ ] One loop: Lenis driven by `gsap.ticker`, ScrollTrigger updated from Lenis
- [ ] Pointer read from `state.pointer` (works for mouse + touch)
- [ ] All signals eased with `MathUtils.damp` before hitting uniforms
- [ ] Exactly one owner for the camera (useFrame OR GSAP timeline)
- [ ] DOM parallax via Motion `useScroll`, never mutating Three objects
- [ ] `prefers-reduced-motion` path implemented and tested
- [ ] Verified on a real phone (touch + inertia + amplitude)
