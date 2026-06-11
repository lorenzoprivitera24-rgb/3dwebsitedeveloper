# scroll-motion-engineer — project memory (live city sim)

## What I own

- `src/camera/CameraRig.tsx` — full rewrite. Single owner of the camera transform.
- `src/motion/useTrafficSpeed.ts` — single owner of `uSpeedScale` (traffic material uniform).
- Updated `src/city/Traffic.tsx` — added `speedScaleRef` prop to expose the uniform.
- Updated `src/canvas/Scene.tsx` — wires `speedScaleRef` + `rigHandle`; calls `useTrafficSpeed`.
- Updated `ARCHITECTURE.md` — ownership table, all APIs, damping constants, design decisions.

## Damping constants

All use MathUtils.damp (framerate-independent).

| Constant | Value | Where used |
|---|---|---|
| LAMBDA_ORBIT | 7 | Desktop orbit damping |
| LAMBDA_ORBIT_MOBILE | 5 | Coarse-pointer / touch orbit damping |
| LAMBDA_ORBIT_REDUCED | 14 | Reduced-motion orbit (snappier = less gratuitous motion) |
| LAMBDA_PARALLAX | 5 | Parallax offset channel ease |
| LAMBDA_PARALLAX_ACTIVE | 12 | Parallax weight fade (drag → idle transition) |

## Parallax / idle drift design

- Parallax uses a **dedicated offset channel** (`parOffset`), not a perturbation of `desired`.
  Never accumulates. Eases to zero while dragging (parActiveWeight → 0) via LAMBDA_PARALLAX_ACTIVE.
- Idle drift: applied to `desired.theta` only after 4s inactivity, at 0.018 rad/s.
- Both disabled (and parOffset eases to zero) when `reduced = true`.

## Touch implementation

- Single-finger drag: same PointerEvent handler as mouse (works via `state.pointer` concept).
- Two-finger pinch: tracked via `Map<pointerId, {x,y}>`. Pinch distance delta → desired.radius.
- Pinch → single-finger transition: graceful (lastPinchDist reset, remaining finger tracked).

## Inertia

- Velocity (dTheta, dPhi) accumulated per drag frame.
- Decay: `0.88 per frame at 60fps` (≈ full stop in ~1s).
- Micro-jitter gate: `Math.abs(velocity) > 0.00001` before applying.

## Fly-to API

Two built-in presets exported from CameraRig.tsx:
- `PRESET_STREET_DUSK`: radius 60, near-horizontal (phi = π/2 - 0.22), 2.4s power3.inOut
- `PRESET_SKYLINE`: radius 320, near-top-down (phi = 0.4), 2.8s power2.inOut

`CameraRigHandle.flyTo(preset)` — GSAP one-shot tween on the desired refs; rig's useFrame
remains sole camera writer. `cancelFly()` kills any in-flight tween immediately.

rigHandle ref is created in Scene.tsx but NOT YET forwarded to App/ControlPanel. UI agent must
add prop chain if they want to wire preset buttons.

## Traffic speed

Per-tier defaults: low=0.65, medium=0.85, high=1.0.
`setTrafficSpeed(multiplier, duration?)` — GSAP one-shot tween on the uniform value.
API available from `useTrafficSpeed` return value. Scene.tsx creates it but does NOT yet forward
it to App/ControlPanel. UI agent must add prop chain for a future speed slider.

## Time-of-day scrub — decision

No easing added. Direct-manipulation slider must track thumb immediately. The sky lagging behind
the slider would feel broken. Easing is appropriate for programmatic transitions, not user-driven.

## Reduced-motion verification

Wire confirmed end-to-end: `useReducedMotion()` → `App.tsx` → `Scene (reduced prop)` → `CameraRig (reduced prop)`.
When reduced=true: parallax/idle drift disabled, orbit lambda doubled, inertia still operable.
No gaps found in existing code; existing `advanceClock` frozen path in SimClockDriver also correct.

## Build status

`npm run build` clean: 78 modules, no TS errors. dist/app ~450KB (149KB gzip), dist/three ~1382KB (373KB gzip).

## Notes for perf auditor

1. `gsap.to()` in useTrafficSpeed creates a tween object per call — verify GSAP does not leave
   dead tweens under rapid slider input (active tween is killed before each new one, but check
   GC pressure on mobile).
2. `useEffect` in useTrafficSpeed that flushes pending values runs every render. Evaluate if hot;
   if so, convert to `useLayoutEffect` with a stable dependency array.
3. Per-frame allocation audit: the old CameraRig created `new Vector3()` inside useFrame every
   frame (line 138). The new rig uses a module-level `_posWork` scratch vector. Confirmed fixed.
4. `Map<number, {x,y}>` in activePointers: entries are created per pointerdown event and deleted
   on pointerup. Object churn is proportional to touch events — negligible for 2-finger max.
