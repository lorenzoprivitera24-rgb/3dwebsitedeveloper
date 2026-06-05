# Performance, fallback and accessibility (June 2026)

A 3D site that runs at 30fps on a mid-range phone or drops frames on scroll is a failed deliverable, however good it looks on a desktop GPU. This file defines the budget and the degradation strategy.

## 1. Performance budget

Targets to design against:

| Metric | Desktop target | Mobile target |
|---|---|---|
| Frame time | < 16.6 ms (60fps) | < 22 ms (45fps acceptable, 60 ideal) |
| Draw calls | < 150 | < 80 |
| Triangles on screen | < 1.5 M | < 500 K |
| Active lights | <= 3 dynamic | <= 2 dynamic |
| Texture budget | keep total decoded textures lean; compress (KTX2/Basis) | stricter, prefer 1k textures |
| JS for the 3D bundle | code-split the canvas; lazy-load Three | same, plus defer until interaction where possible |
| Initial hero | first meaningful paint should not wait on the full scene | show DOM + a loader, hydrate 3D after |

## 2. The big levers (in order of impact)

1. **Instancing.** Anything repeated (particles, tiles, repeated objects) goes through `InstancedMesh` (or compute-driven instances on WebGPU). One draw call for thousands of objects.
2. **Compute over CPU (WebGPU).** Move particle/physics updates to a compute shader. CPU per-frame loops over thousands of objects are the classic jank source.
3. **On-demand rendering when idle.** If the scene is static between interactions, set `frameloop="demand"` and call `invalidate()` on change. Note: a continuously scroll/pointer-driven hero is *not* idle, so this applies to sub-scenes, not the live morph.
4. **Cap DPR.** `dpr={[1, 2]}`. Never render at an uncapped `devicePixelRatio` (retina/phones can be 3x, quadrupling fragment work).
5. **Fewer, cheaper lights.** Prefer an environment map (`Environment` from drei) plus one key light over many dynamic lights. Bake where possible.
6. **Compress assets.** Draco/Meshopt for geometry, KTX2/Basis for textures. Preload, and dispose what you swap out.
7. **Throttle post FX.** Bloom and DOF are expensive; measure each pass, drop the heaviest on mobile.

## 3. On-demand rendering pattern

```tsx
import { Canvas } from '@react-three/fiber'

<Canvas frameloop="demand" dpr={[1, 2]}>
  {/* ... */}
</Canvas>
```

```tsx
import { useThree } from '@react-three/fiber'
function Thing() {
  const invalidate = useThree((s) => s.invalidate)
  const onChange = () => { /* mutate state */ invalidate() } // request one frame
  return <mesh onClick={onChange}>{/* ... */}</mesh>
}
```

For the always-animating hero, keep `frameloop="always"` but reduce per-frame cost (amplitude, subdivisions, particle count) on smaller viewports.

## 4. Responsive quality tiers

Pick a tier from viewport + backend + device memory, and feed it into the scene.

```tsx
function qualityTier() {
  const w = window.innerWidth
  const mem = (navigator as any).deviceMemory ?? 4
  const coarse = window.matchMedia('(pointer: coarse)').matches // touch device
  if (coarse || w < 768 || mem <= 2) return 'low'
  if (w < 1280 || mem <= 4) return 'medium'
  return 'high'
}

// usage: geometry detail, particle count, DPR cap, post FX on/off all read the tier
const tier = qualityTier()
const detail = { low: 32, medium: 96, high: 128 }[tier]
const particles = { low: 5_000, medium: 50_000, high: 200_000 }[tier]
```

## 5. WebGPU to WebGL2 fallback

`renderer.init()` resolves to WebGPU when available and falls back to WebGL2 automatically, so the same TSL materials run on both. The only things to gate explicitly are WebGPU-only features:

```tsx
const renderer = useThree((s) => s.gl)
const isWebGPU = renderer.isWebGPURenderer

// compute particles only on WebGPU; instanced points cloud otherwise
{isWebGPU ? <ComputeParticles count={particles} /> : <InstancedParticles count={Math.min(particles, 20_000)} />}
```

Also provide a **no-WebGL** path: if WebGL2 itself is unavailable or the canvas fails to create a context, render a static poster image / styled DOM hero so the page is never blank.

## 6. prefers-reduced-motion (required, not optional)

Some users get motion sickness from scroll-jacked 3D. Detect and provide a calm path.

```tsx
function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setReduced(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduced
}
```

When `reduced` is true:
- set displacement amplitude to ~0 (the form is calm/static),
- stop the camera scroll animation (or make it a gentle fade instead of movement),
- disable Lenis smoothing if it causes discomfort, or keep content reachable by normal scroll,
- keep all text, links, and CTAs fully accessible. Never hide content behind motion.

## 7. Accessibility beyond motion

- The 3D canvas is decorative for screen readers: `aria-hidden="true"` on the canvas wrapper, with the real content in semantic DOM.
- All interactive controls must be real focusable DOM elements with labels, not click-only 3D objects. If a 3D object is the only way to trigger something, mirror it with an accessible DOM control.
- Maintain color contrast on the DOM overlay regardless of what the 3D background is doing (add a scrim/gradient behind text if needed).
- Verify keyboard tab order is not broken by Lenis (it runs on native scroll, so it usually is not, but test).

## 8. Measuring (do this, do not guess)

- `r3f-perf` (drei ecosystem) overlay for draw calls, triangles, GPU time during development.
- Chrome DevTools Performance panel, CPU throttled to 4x, network throttled, on a mid-tier device profile.
- Lighthouse for the DOM/initial-load story (the 3D should not block first paint).
- Test on a real phone before calling it done.

## 9. Checklist for the perf/fallback auditor (read-only report)

Return findings as Critical / Warning / Suggestion.

- [ ] DPR capped at 2 (Critical if uncapped)
- [ ] Repeated objects instanced (Critical if N>~100 separate meshes)
- [ ] Lights <= tier budget; environment map used instead of many lights
- [ ] Assets compressed (Draco/Meshopt + KTX2) and preloaded
- [ ] Compute features gated behind `isWebGPURenderer`; WebGL2 fallback present
- [ ] No-WebGL poster fallback present
- [ ] `prefers-reduced-motion` path implemented
- [ ] Canvas `aria-hidden`, interactive controls mirrored in accessible DOM
- [ ] 3D bundle code-split; canvas does not block first paint
- [ ] Single render/scroll loop (no duplicate RAF)
- [ ] Profiled on a throttled / real mobile device
