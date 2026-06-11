import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MathUtils, Spherical, Vector3 } from 'three'

/**
 * Camera rig skeleton: a damped, constrained orbit around a target.
 *
 * Hand-rolled (no drei OrbitControls) on purpose — see ARCHITECTURE.md "Why no drei". The rig
 * keeps the camera as the SINGLE owner of camera transform: it integrates a target spherical
 * (radius, theta, phi) from input, then damps the actual camera toward it every frame.
 *
 * CONSTRAINTS enforced here (do not remove): radius clamped to [minDistance, maxDistance];
 * polar angle phi clamped so the camera never dips to or below the ground plane.
 *
 * [motion engineer] OWNS THE FEEL. Tune the damping rates, drag sensitivity, parallax amount,
 * idle-drift amplitude/period, and zoom limits. Add inertia/fly-to (GSAP one-shot is allowed for
 * a fly-to since nothing else drives the camera per frame — but hand control back to this rig
 * afterward; never co-drive the camera from two systems in the same frame). The damped-orbit
 * integration and the ground-clamp are the load-bearing parts to preserve.
 */

export interface CameraRigConfig {
  target: [number, number, number]
  minDistance: number
  maxDistance: number
  /** Initial orbit radius. */
  distance: number
  /** Min polar angle (radians from +Y). Small = looking from near top-down. */
  minPolar: number
  /** Max polar angle. Keep < PI/2 so the camera stays above the horizon / ground. */
  maxPolar: number
}

interface Props {
  config: CameraRigConfig
  reduced: boolean
  /** When true, allow pointer parallax + idle cinematic drift. Motion engineer tunes. */
  enableParallax?: boolean
  enableIdleDrift?: boolean
}

export function CameraRig({ config, reduced, enableParallax = true, enableIdleDrift = true }: Props) {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const pointer = useThree((s) => s.pointer)

  const targetVec = useMemo(() => new Vector3(...config.target), [config.target])

  // The desired orbit, integrated from user input (drag + wheel).
  const desired = useRef(
    new Spherical(config.distance, MathUtils.clamp(Math.PI / 3, config.minPolar, config.maxPolar), Math.PI / 4),
  )
  // The smoothed orbit the camera actually uses (damped toward `desired`).
  const current = useRef(desired.current.clone())

  // drag state
  const dragging = useRef(false)
  const last = useRef({ x: 0, y: 0 })
  const idleTime = useRef(0)

  // Pointer/touch drag + wheel zoom on the canvas element. Listeners are cleaned up on unmount.
  useEffect(() => {
    const el = gl.domElement

    const onDown = (e: PointerEvent) => {
      dragging.current = true
      last.current = { x: e.clientX, y: e.clientY }
      idleTime.current = 0
      el.setPointerCapture?.(e.pointerId)
    }
    const onUp = (e: PointerEvent) => {
      dragging.current = false
      el.releasePointerCapture?.(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return
      const dx = e.clientX - last.current.x
      const dy = e.clientY - last.current.y
      last.current = { x: e.clientX, y: e.clientY }
      const s = desired.current
      s.theta -= dx * 0.005 // azimuth
      s.phi = MathUtils.clamp(s.phi - dy * 0.005, config.minPolar, config.maxPolar)
      idleTime.current = 0
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const s = desired.current
      s.radius = MathUtils.clamp(s.radius * (1 + Math.sign(e.deltaY) * 0.08), config.minDistance, config.maxDistance)
      idleTime.current = 0
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('wheel', onWheel)
    }
  }, [gl, config.minDistance, config.maxDistance, config.minPolar, config.maxPolar])

  useFrame((_state, delta) => {
    const dt = Math.min(delta, 0.1)
    const d = desired.current
    const c = current.current

    // idle cinematic drift: slow azimuth sweep + gentle parallax, only after a quiet period.
    let parX = 0
    let parY = 0
    if (!reduced) {
      idleTime.current += dt
      if (enableIdleDrift && !dragging.current && idleTime.current > 3) {
        d.theta += dt * 0.02 // very slow auto-orbit
      }
      if (enableParallax && !dragging.current) {
        // subtle parallax toward the pointer; this nudges the *current* orbit, not the desired,
        // so it reads as a soft sway and never accumulates.
        parX = pointer.x * 0.04
        parY = -pointer.y * 0.03
      }
    }

    // enforce constraints on the desired orbit every frame (defensive).
    d.radius = MathUtils.clamp(d.radius, config.minDistance, config.maxDistance)
    d.phi = MathUtils.clamp(d.phi, config.minPolar, config.maxPolar)

    // frame-rate independent damping toward the desired orbit.
    const rate = reduced ? 12 : 6
    c.radius = MathUtils.damp(c.radius, d.radius, rate, dt)
    c.theta = MathUtils.damp(c.theta, d.theta + parX, rate, dt)
    c.phi = MathUtils.clamp(MathUtils.damp(c.phi, d.phi + parY, rate, dt), config.minPolar, config.maxPolar)

    // spherical -> cartesian around the target.
    const pos = new Vector3().setFromSpherical(c).add(targetVec)
    camera.position.copy(pos)
    camera.lookAt(targetVec)
  })

  return null
}
