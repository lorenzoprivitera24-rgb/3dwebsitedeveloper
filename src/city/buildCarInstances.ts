import type { Lane } from './types'

/**
 * Distributes `carCount` cars across the city's lanes and produces the per-instance buffers
 * the TSL car material reads. This is PURE data prep (no three.js): deterministic from the
 * lane set + a seed, returns typed arrays + the matching attribute layout.
 *
 * MOTION MODEL (the contract for the shader engineer):
 *   Each car rides a single straight lane. The lane is defined by a start point and a unit
 *   direction; the car's signed distance along the lane is:
 *
 *       d(t) = mod( aPhase + uTime * aSpeed, aLaneLength )
 *       worldPos = aLaneStart + aLaneDir * d(t)
 *
 *   Heading (for orienting the car body + headlights) is aLaneDir (a constant per car here,
 *   since lanes are straight). The shader builds the car's facing from aLaneDir.xz.
 *
 *   This is exactly the "compute motion in-shader from time + per-instance data" pattern from
 *   three r184 examples/webgpu_instance_path.html, so it runs identically on WebGPU and WebGL2.
 *   The optional WebGPU-only enhancement (compute pass for car-follow spacing / braking) writes
 *   into the SAME worldPos formula's inputs — see ARCHITECTURE.md extension point.
 *
 * Attribute layout (all Float32, one element per car, attach to the car InstancedMesh geometry):
 *   aLaneStart   : vec3  world-space lane entry point (at car deck height)
 *   aLaneDir     : vec3  unit direction of travel
 *   aLaneLength  : float lane length in meters (for the mod wrap)
 *   aPhase       : float starting distance offset along the lane (meters), 0..laneLength
 *   aSpeed       : float meters/sec along the lane
 *   aCar         : vec2  [colorSeed 0..1, sizeSeed 0..1] for per-car body color + slight scale
 */

export interface CarInstanceBuffers {
  count: number
  laneStart: Float32Array // count * 3
  laneDir: Float32Array // count * 3
  laneLength: Float32Array // count * 1
  phase: Float32Array // count * 1
  speed: Float32Array // count * 1
  car: Float32Array // count * 2
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SPEED_MIN = 6 // m/s (~22 km/h)
const SPEED_MAX = 14 // m/s (~50 km/h)

export function buildCarInstances(lanes: Lane[], carCount: number, seed: number): CarInstanceBuffers {
  const rand = mulberry32(seed ^ 0x9e3779b9)
  const count = lanes.length === 0 ? 0 : carCount

  const laneStart = new Float32Array(count * 3)
  const laneDir = new Float32Array(count * 3)
  const laneLength = new Float32Array(count)
  const phase = new Float32Array(count)
  const speed = new Float32Array(count)
  const car = new Float32Array(count * 2)

  for (let i = 0; i < count; i++) {
    // round-robin across lanes, with extra cars looping back over lanes again.
    const lane = lanes[i % lanes.length]
    const a = lane.waypoints[0]
    const b = lane.waypoints[lane.waypoints.length - 1]
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const dz = b[2] - a[2]
    const len = lane.length || Math.hypot(dx, dy, dz) || 1

    laneStart[i * 3 + 0] = a[0]
    laneStart[i * 3 + 1] = a[1]
    laneStart[i * 3 + 2] = a[2]

    laneDir[i * 3 + 0] = dx / len
    laneDir[i * 3 + 1] = dy / len
    laneDir[i * 3 + 2] = dz / len

    laneLength[i] = len
    phase[i] = rand() * len // spread cars along the lane
    speed[i] = SPEED_MIN + rand() * (SPEED_MAX - SPEED_MIN)

    car[i * 2 + 0] = rand() // colorSeed
    car[i * 2 + 1] = rand() // sizeSeed
  }

  return { count, laneStart, laneDir, laneLength, phase, speed, car }
}
