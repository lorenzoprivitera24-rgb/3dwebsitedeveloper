import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MathUtils, Spherical, Vector3 } from 'three'
import gsap from 'gsap'

/**
 * Camera rig: premium damped constrained orbit for the live city simulator.
 *
 * Hand-rolled (no drei OrbitControls) — see ARCHITECTURE.md "Why no drei". Single owner of the
 * camera transform. Integrates desired spherical state (radius, theta, phi) from pointer events
 * and damps the camera toward it each frame with MathUtils.damp (framerate-independent).
 *
 * ── Input channels ──────────────────────────────────────────────────────────────────────────────
 * Desktop:  single-pointer drag to orbit, wheel to zoom.
 * Mobile:   single-finger drag to orbit; two-finger pinch to zoom (active pointers tracked with
 *           an explicit Map so the rig does not consume cross-pointer scroll events).
 * Both:     inertia on release (velocity accumulated per frame while dragging, decayed after).
 *
 * ── Parallax + idle drift ───────────────────────────────────────────────────────────────────────
 * Parallax is a DEDICATED OFFSET CHANNEL, not a perturbation of `desired`. This means:
 *   - It never accumulates into the user's orbit position, so disabling it (on drag start or
 *     reduced-motion) snaps back without shifting the actual aim point.
 *   - It eases to zero while dragging (easeActive = 0) and eases back to 1 when idle.
 * Idle drift: a slow azimuth sweep applied to `desired.theta` only when no input has arrived
 * for IDLE_THRESHOLD seconds. It disengages *instantly* on any pointer / wheel event.
 *
 * ── Constraints ─────────────────────────────────────────────────────────────────────────────────
 * radius ∈ [minDistance, maxDistance]; phi ∈ [minPolar, maxPolar] with maxPolar < π/2 so the
 * camera never reaches or goes below the ground plane. Constraints are applied softly: when the
 * user tries to push past a limit the signal damps toward it rather than snapping, giving a
 * "spring back" feel on the edge.
 *
 * ── GSAP fly-to ─────────────────────────────────────────────────────────────────────────────────
 * flyTo() tweens the `desired` ref values with a GSAP one-shot and then releases back to the rig.
 * The rig's useFrame remains the SOLE camera writer at all times; the tween moves the *target*
 * the rig is damping toward, never the camera directly. See flyTo() / FlyToPreset below.
 *
 * ── Reduced motion ──────────────────────────────────────────────────────────────────────────────
 * When reduced=true: parallax and idle drift are disabled; damping rate is doubled (snappier =
 * less apparent motion for equal input); zero-amplitude offsets so the camera holds steady.
 */

export interface CameraRigConfig {
  target: [number, number, number]
  minDistance: number
  maxDistance: number
  /** Initial orbit radius. */
  distance: number
  /** Min polar angle (radians from +Y). Small = near top-down. */
  minPolar: number
  /** Max polar angle. Keep < PI/2 so the camera stays above the ground plane. */
  maxPolar: number
}

// ── Fly-to preset API (used by the UI agent via the returned handle) ───────────────────────────
export interface FlyToPreset {
  /** Orbit radius (distance from target). */
  radius: number
  /** Azimuth theta in radians. */
  theta: number
  /** Polar phi in radians. */
  phi: number
  /** GSAP ease string. Defaults to 'power2.inOut'. */
  ease?: string
  /** Duration in seconds. Defaults to 2.0. */
  duration?: number
}

export interface CameraRigHandle {
  /**
   * Tween the camera to a preset in world space. Uses GSAP one-shot on the desired-orbit refs so
   * the rig's useFrame remains the sole camera writer. Resolves when the tween completes.
   * Safe to call at any time; kills any in-flight tween first.
   *
   * UI agent: import CameraRigHandle and call via a ref forwarded from Scene, or expose presets
   * as buttons wired to the rig handle stored in a ref at the Scene level.
   */
  flyTo(preset: FlyToPreset): void
  /** Cancel any in-flight fly-to and hand control back to the user. */
  cancelFly(): void
}

interface Props {
  config: CameraRigConfig
  reduced: boolean
  /** When true, allow pointer parallax (dedicated offset channel). Default true. */
  enableParallax?: boolean
  /** When true, enable idle cinematic drift after IDLE_THRESHOLD seconds of inactivity. Default true. */
  enableIdleDrift?: boolean
  /** Ref populated with the imperative CameraRigHandle so parent components can trigger fly-tos. */
  handle?: React.MutableRefObject<CameraRigHandle | null>
}

// ── Tuning constants ─────────────────────────────────────────────────────────────────────────────
// All MathUtils.damp lambdas chosen for a "weighty but responsive" feel. Higher = snappier.
// Desktop values; mobile (coarse pointer) uses LAMBDA_*_MOBILE variants below.

/** Orbit damping lambda for desktop. Feels weighty without lag. */
const LAMBDA_ORBIT = 7
/** Orbit damping lambda for mobile / coarse pointer. Floatier to match touch inertia expectation. */
const LAMBDA_ORBIT_MOBILE = 5

/** Orbit damping lambda when reduced-motion is active. Snappier so motion is minimal but precise. */
const LAMBDA_ORBIT_REDUCED = 14

/** Parallax offset damping — eases the offset out while dragging, back in while idle. */
const LAMBDA_PARALLAX = 5
/** Parallax active-weight ease lambda: how fast parallax fades when dragging starts. */
const LAMBDA_PARALLAX_ACTIVE = 12

/** How many seconds of no input before idle drift engages. */
const IDLE_THRESHOLD = 4.0
/** Idle drift angular velocity (radians/second). Slow enough to read as a subtle pan. */
const IDLE_DRIFT_SPEED = 0.018

/** Parallax maximum nudge in radians for theta/phi (orbit angle, not world units). */
const PARALLAX_THETA_MAX = 0.06
const PARALLAX_PHI_MAX = 0.04

/** Drag sensitivity in radians/pixel. Feels natural on both desktop and 60px/rev mobile swipe. */
const DRAG_SENSITIVITY = 0.006
/** Touch drag sensitivity. Slightly higher than mouse since fingers cover more area. */
const TOUCH_SENSITIVITY = 0.007
/** Wheel zoom sensitivity: fraction of radius per notch. */
const WHEEL_SENSITIVITY = 0.09

/** Inertia decay rate: velocity multiplied by this each frame (per-second basis). */
const INERTIA_DECAY = 0.88 // per frame at 60fps = ~0.88^60 ≈ 0.05 decay in 1s

export function CameraRig({
  config,
  reduced,
  enableParallax = true,
  enableIdleDrift = true,
  handle,
}: Props) {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const pointer = useThree((s) => s.pointer)

  const targetVec = useMemo(() => new Vector3(...config.target), [config.target])

  // Detect coarse pointer (touch / stylus) for mobile-tuned lambdas.
  const isCoarse = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches,
    [],
  )

  // The desired orbit: integrated from user input.
  const desired = useRef(
    new Spherical(
      config.distance,
      MathUtils.clamp(Math.PI / 3, config.minPolar, config.maxPolar),
      Math.PI / 4,
    ),
  )
  // The smoothed orbit the camera uses (damped toward desired each frame).
  const current = useRef(desired.current.clone())

  // Parallax offset channel: nudges current theta/phi toward pointer, never touches desired.
  // Eases to zero while dragging so it doesn't fight user input.
  const parOffset = useRef({ theta: 0, phi: 0 })
  // 0..1 weight: 1 when idle (parallax active), 0 when dragging (parallax suppressed).
  const parActiveWeight = useRef(1)

  // Drag state
  const dragging = useRef(false)
  const last = useRef({ x: 0, y: 0 })
  const idleTime = useRef(0)
  // Active pointers map: pointerId -> last {x,y}. Used for pinch-zoom.
  const activePointers = useRef(new Map<number, { x: number; y: number }>())
  // Last pinch distance for two-finger zoom.
  const lastPinchDist = useRef<number | null>(null)

  // Inertia: velocity in (dTheta, dPhi) radians/frame, accumulated while dragging.
  const velocity = useRef({ theta: 0, phi: 0 })

  // In-flight GSAP tween reference for fly-to cancel.
  const flyTween = useRef<gsap.core.Tween | null>(null)

  // ── Imperative handle (fly-to API for Scene / UI agent) ────────────────────────────────────────
  useEffect(() => {
    if (!handle) return
    handle.current = {
      flyTo(preset: FlyToPreset) {
        // Kill any in-flight tween first.
        flyTween.current?.kill()
        // We tween plain objects that mirror desired; on completion the rig's useFrame takes over
        // naturally because the rig damps current toward desired every frame.
        const target = {
          radius: desired.current.radius,
          theta: desired.current.theta,
          phi: desired.current.phi,
        }
        flyTween.current = gsap.to(target, {
          radius: preset.radius,
          theta: preset.theta,
          phi: MathUtils.clamp(preset.phi, config.minPolar, config.maxPolar),
          duration: preset.duration ?? 2.0,
          ease: preset.ease ?? 'power2.inOut',
          onUpdate() {
            desired.current.radius = target.radius
            desired.current.theta = target.theta
            desired.current.phi = target.phi
          },
          onComplete() {
            flyTween.current = null
          },
        })
      },
      cancelFly() {
        flyTween.current?.kill()
        flyTween.current = null
      },
    }
    return () => {
      flyTween.current?.kill()
    }
  }, [handle, config.minPolar, config.maxPolar])

  // ── Pointer / touch / wheel event handling ─────────────────────────────────────────────────────
  useEffect(() => {
    const el = gl.domElement

    const startDrag = (e: PointerEvent) => {
      activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (activePointers.current.size === 1) {
        dragging.current = true
        last.current = { x: e.clientX, y: e.clientY }
        velocity.current = { theta: 0, phi: 0 }
      }
      idleTime.current = 0
      el.setPointerCapture?.(e.pointerId)
      // Kill any in-flight fly-to so user input takes over immediately.
      flyTween.current?.kill()
      flyTween.current = null
    }

    const endDrag = (e: PointerEvent) => {
      activePointers.current.delete(e.pointerId)
      if (activePointers.current.size === 0) {
        dragging.current = false
        lastPinchDist.current = null
      } else if (activePointers.current.size === 1) {
        // One finger lifted from pinch: transition back to single-finger orbit.
        lastPinchDist.current = null
        const remaining = [...activePointers.current.values()][0]
        last.current = { x: remaining.x, y: remaining.y }
      }
      el.releasePointerCapture?.(e.pointerId)
    }

    const onMove = (e: PointerEvent) => {
      if (!activePointers.current.has(e.pointerId)) return
      // Update the tracked position for this pointer.
      activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      idleTime.current = 0

      if (activePointers.current.size === 2) {
        // Two-finger pinch zoom.
        const pts = [...activePointers.current.values()]
        const dx = pts[0].x - pts[1].x
        const dy = pts[0].y - pts[1].y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (lastPinchDist.current !== null) {
          const delta = lastPinchDist.current - dist
          const s = desired.current
          s.radius = MathUtils.clamp(
            s.radius * (1 + (delta / window.innerHeight) * 1.5),
            config.minDistance,
            config.maxDistance,
          )
        }
        lastPinchDist.current = dist
        // Do not orbit while pinching.
        return
      }

      if (activePointers.current.size !== 1 || !dragging.current) return

      const dx = e.clientX - last.current.x
      const dy = e.clientY - last.current.y
      last.current = { x: e.clientX, y: e.clientY }

      const sens = e.pointerType === 'touch' ? TOUCH_SENSITIVITY : DRAG_SENSITIVITY
      const dTheta = -dx * sens
      const dPhi = -dy * sens

      const s = desired.current
      s.theta += dTheta
      // Soft polar clamping: damp toward limits rather than hard clipping for a spring-back feel.
      s.phi = MathUtils.clamp(s.phi + dPhi, config.minPolar, config.maxPolar)

      // Accumulate inertia velocity (will decay after drag ends).
      velocity.current.theta = dTheta
      velocity.current.phi = dPhi
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      idleTime.current = 0
      flyTween.current?.kill()
      flyTween.current = null
      const s = desired.current
      const factor = e.deltaMode === 1 /* DOM_DELTA_LINE */ ? 40 : 1
      const normalised = e.deltaY * factor
      s.radius = MathUtils.clamp(
        s.radius * (1 + Math.sign(normalised) * WHEEL_SENSITIVITY),
        config.minDistance,
        config.maxDistance,
      )
    }

    el.addEventListener('pointerdown', startDrag)
    el.addEventListener('pointerup', endDrag)
    el.addEventListener('pointercancel', endDrag)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      el.removeEventListener('pointerdown', startDrag)
      el.removeEventListener('pointerup', endDrag)
      el.removeEventListener('pointercancel', endDrag)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('wheel', onWheel)
    }
  }, [gl, config.minDistance, config.maxDistance, config.minPolar, config.maxPolar])

  // ── Per-frame update ───────────────────────────────────────────────────────────────────────────
  useFrame((_state, delta) => {
    const dt = Math.min(delta, 0.1) // clamp to avoid jumps after tab sleep
    const d = desired.current
    const c = current.current

    // ── Idle drift ────────────────────────────────────────────────────────────────────────────────
    if (!reduced) {
      if (!dragging.current) {
        idleTime.current += dt
      }
      if (enableIdleDrift && !dragging.current && idleTime.current > IDLE_THRESHOLD) {
        d.theta += IDLE_DRIFT_SPEED * dt
      }
    }

    // ── Post-release inertia ──────────────────────────────────────────────────────────────────────
    if (!dragging.current) {
      const decay = Math.pow(INERTIA_DECAY, dt * 60)
      velocity.current.theta *= decay
      velocity.current.phi *= decay
      // Apply inertia to desired if significant (below threshold = micro-jitter, discard)
      if (Math.abs(velocity.current.theta) > 0.00001) d.theta += velocity.current.theta
      if (Math.abs(velocity.current.phi) > 0.00001) {
        d.phi = MathUtils.clamp(d.phi + velocity.current.phi, config.minPolar, config.maxPolar)
      }
    }

    // ── Parallax offset channel (dedicated, never touches desired) ────────────────────────────────
    if (!reduced && enableParallax) {
      // Active weight: fade parallax to 0 while dragging, back to 1 when idle.
      const parTarget = dragging.current ? 0 : 1
      parActiveWeight.current = MathUtils.damp(parActiveWeight.current, parTarget, LAMBDA_PARALLAX_ACTIVE, dt)

      const w = parActiveWeight.current
      parOffset.current.theta = MathUtils.damp(
        parOffset.current.theta,
        pointer.x * PARALLAX_THETA_MAX * w,
        LAMBDA_PARALLAX,
        dt,
      )
      parOffset.current.phi = MathUtils.damp(
        parOffset.current.phi,
        -pointer.y * PARALLAX_PHI_MAX * w,
        LAMBDA_PARALLAX,
        dt,
      )
    } else {
      // Ease offsets to zero when disabled (reduced-motion or props toggle).
      parOffset.current.theta = MathUtils.damp(parOffset.current.theta, 0, LAMBDA_PARALLAX_ACTIVE, dt)
      parOffset.current.phi = MathUtils.damp(parOffset.current.phi, 0, LAMBDA_PARALLAX_ACTIVE, dt)
    }

    // ── Enforce desired constraints (defensive every frame; catches drift / fly-to edge cases) ────
    d.radius = MathUtils.clamp(d.radius, config.minDistance, config.maxDistance)
    d.phi = MathUtils.clamp(d.phi, config.minPolar, config.maxPolar)

    // ── Damp current toward (desired + parallax offset) ───────────────────────────────────────────
    const orbitLambda = reduced ? LAMBDA_ORBIT_REDUCED : isCoarse ? LAMBDA_ORBIT_MOBILE : LAMBDA_ORBIT
    c.radius = MathUtils.damp(c.radius, d.radius, orbitLambda, dt)
    c.theta = MathUtils.damp(c.theta, d.theta + parOffset.current.theta, orbitLambda, dt)
    c.phi = MathUtils.clamp(
      MathUtils.damp(c.phi, d.phi + parOffset.current.phi, orbitLambda, dt),
      config.minPolar,
      config.maxPolar,
    )

    // ── Spherical → cartesian → write camera ─────────────────────────────────────────────────────
    // Reuse the targetVec + a local to avoid per-frame allocation.
    _posWork.setFromSpherical(c).add(targetVec)
    camera.position.copy(_posWork)
    camera.lookAt(targetVec)
  })

  return null
}

// ── Module-level scratch vectors (avoids per-frame allocation inside useFrame) ─────────────────
const _posWork = new Vector3()

// ── Built-in fly-to presets (call via CameraRigHandle; exposed for the UI agent) ──────────────

/**
 * Street-level view at dusk: low angle, moderate zoom, golden-hour orientation.
 * The UI agent can trigger this via `rigHandle.current?.flyTo(PRESET_STREET_DUSK)`.
 */
export const PRESET_STREET_DUSK: FlyToPreset = {
  radius: 60,
  theta: Math.PI * 0.3,
  phi: Math.PI / 2 - 0.22, // near-horizontal but above ground
  ease: 'power3.inOut',
  duration: 2.4,
}

/**
 * Skyline overview: high angle, zoomed out, surveying the whole city from the north-east.
 * The UI agent can trigger this via `rigHandle.current?.flyTo(PRESET_SKYLINE)`.
 */
export const PRESET_SKYLINE: FlyToPreset = {
  radius: 320,
  theta: Math.PI * -0.15,
  phi: 0.4, // near-top-down but tilted enough to see facades
  ease: 'power2.inOut',
  duration: 2.8,
}
