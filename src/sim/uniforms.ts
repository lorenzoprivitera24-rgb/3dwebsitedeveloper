import { uniform } from 'three/tsl'
import { Vector3 } from 'three'

/**
 * SHARED SIM UNIFORMS — the contract surface between the simulation (architect, who DRIVES
 * them) and the TSL materials (shader engineer, who READS them).
 *
 * One module, one set of uniform node objects, created once. Every material imports THESE
 * objects (not fresh copies) so there is a single source of truth and a single writer
 * (SimClockDriver, in one useFrame). This is the "one owner per property" rule applied to
 * uniforms: the shader engineer must never write these, only read them in node graphs.
 *
 * How the shader engineer uses them, e.g.:
 *   import { simUniforms } from '../sim/uniforms'
 *   material.emissiveNode = windowLights.mul(simUniforms.uDayPhase.oneMinus())
 *   const sunDot = normalWorld.dot(simUniforms.uSunDirection)
 */
export const simUniforms = {
  /** Monotonic sim time in seconds (for animation phase: traffic, flicker, etc.). */
  uTime: uniform(0),
  /** Time of day, 0..1. 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset. */
  uDayPhase: uniform(0),
  /** 0..1 "how much daylight" (smooth night->day blend). Convenient for window-light fade. */
  uDaylight: uniform(1),
  /** Unit vector pointing from the scene toward the sun (light incoming direction). */
  uSunDirection: uniform(new Vector3(0, 1, 0)),
} as const

export type SimUniforms = typeof simUniforms
