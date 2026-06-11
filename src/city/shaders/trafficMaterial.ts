/**
 * Traffic car material (shader engineer, deliverable #1).
 *
 * Motion is computed entirely on the GPU in `positionNode` from `simUniforms.uTime` + the
 * per-instance lane attributes, so it runs identically on WebGPU (WGSL) and WebGL2 (GLSL) — the
 * deterministic path required by the brief. No `useFrame` drives the cars.
 *
 * Contract (ARCHITECTURE.md / buildCarInstances.ts):
 *   d       = mod(aPhase + uTime * aSpeed, aLaneLength)   // distance along the lane (m)
 *   pos     = aLaneStart + aLaneDir * d                   // world position of the car
 *   heading = atan2(aLaneDir.x, aLaneDir.z)               // yaw; maps local +Z to the lane dir
 * The unit box has its length along local +Z (BoxGeometry(W,H,L)), so after the Y-rotation by
 * `heading` the local +Z face is the FRONT of the car — headlights live there, taillights on -Z.
 *
 * Per-instance attributes read here:
 *   aLaneStart vec3, aLaneDir vec3, aLaneLength float, aPhase float, aSpeed float,
 *   aCar vec2 = [colorSeed 0..1, sizeSeed 0..1]
 *
 * Reads (never writes) the shared sim uniforms: uTime, uDaylight.
 *
 * Cost: one instanced draw call, a box body, all-analytic. The headlight/taillight glow is a few
 * cheap fragment ops gated by uDaylight, no extra geometry and no scene lights.
 */
import type { Node } from 'three/webgpu'
import { MeshStandardNodeMaterial } from 'three/webgpu'
import {
  attribute,
  float,
  vec3,
  mod,
  atan,
  rotate,
  positionGeometry,
  smoothstep,
  clamp,
  mix,
  step,
  uniform,
} from 'three/tsl'
import { simUniforms } from '../../sim/uniforms'
import { hash11 } from './tslHelpers'

type FloatNode = Node<'float'>
type Vec3Node = Node<'vec3'>

// Capture the concrete uniform node type without importing the generic directly.
const _floatUniform = () => uniform(0)
export type FloatUniform = ReturnType<typeof _floatUniform>

// Local body half-extents (must match makeCarGeometry in Traffic.tsx: BoxGeometry(2.0, 1.5, 4.4)).
const HALF_LEN = 4.4 / 2
const HALF_W = 2.0 / 2

// Tasteful automotive palette (sampled by colorSeed). Realistic, slightly desaturated:
// mostly neutral metals (silver/grey/black/white) with the occasional saturated body.
const CAR_COLORS: [number, number, number][] = [
  [0.86, 0.87, 0.9], // silver
  [0.08, 0.09, 0.11], // near-black
  [0.9, 0.9, 0.92], // white
  [0.32, 0.35, 0.4], // gunmetal
  [0.55, 0.07, 0.08], // deep red
  [0.07, 0.15, 0.4], // navy blue
  [0.12, 0.28, 0.2], // racing green
  [0.6, 0.58, 0.55], // champagne
]

/**
 * Build the car body color from colorSeed (0..1) as a TSL node. We unroll the small palette into
 * nested mixes keyed on the seed buckets — no array indexing needed, identical on both backends.
 */
function carColorNode(colorSeed: FloatNode): Vec3Node {
  const n = CAR_COLORS.length
  let col: Vec3Node = vec3(...CAR_COLORS[0])
  for (let i = 1; i < n; i++) {
    // step turns on once seed crosses this bucket boundary -> pick palette[i]
    const t = step(float(i / n), colorSeed)
    col = mix(col, vec3(...CAR_COLORS[i]), t)
  }
  return col
}

export interface TrafficMaterialResult {
  material: MeshStandardNodeMaterial
  /** Material-local: extra global speed multiplier the motion engineer MAY tune per tier. Default 1. */
  uSpeedScale: FloatUniform
}

export function makeTrafficMaterial(): TrafficMaterialResult {
  const material = new MeshStandardNodeMaterial({ metalness: 0.55, roughness: 0.35 })

  // --- per-instance attributes (cast to the proper node types for swizzle/math) ---
  const aLaneStart = attribute('aLaneStart', 'vec3') as unknown as Vec3Node
  const aLaneDir = attribute('aLaneDir', 'vec3') as unknown as Vec3Node
  const aLaneLength = attribute('aLaneLength', 'float') as unknown as FloatNode
  const aPhase = attribute('aPhase', 'float') as unknown as FloatNode
  const aSpeed = attribute('aSpeed', 'float') as unknown as FloatNode
  const aCar = attribute('aCar', 'vec2') as unknown as Node<'vec2'>

  const colorSeed = aCar.x
  const sizeSeed = aCar.y

  // Material-local speed scale (defaults to 1 = exactly the contract formula). The motion engineer
  // owns this one if they want global traffic faster/slower; the deterministic formula is preserved.
  const uSpeedScale = uniform(1)

  // --- motion: d = mod(aPhase + uTime*aSpeed, aLaneLength); pos = aLaneStart + aLaneDir*d ---
  const d = mod(aPhase.add(simUniforms.uTime.mul(aSpeed).mul(uSpeedScale)), aLaneLength)
  const carPos = aLaneStart.add(aLaneDir.mul(d))

  // heading = atan2(aLaneDir.x, aLaneDir.z); rotate the body around Y so +Z faces the lane dir.
  const heading = atan(aLaneDir.x, aLaneDir.z)

  // slight per-car size variation from sizeSeed (geometry is a fixed box; scale it in-node).
  // We build placement from positionGeometry (the RAW unit-box vertex) and set the instance matrices
  // to identity in Traffic.tsx, so this fully controls each car's transform with no double-transform.
  const scale = mix(float(0.92), float(1.12), sizeSeed)
  const localScaled = positionGeometry.mul(scale)
  const rotated = rotate(localScaled, vec3(0, heading, 0))
  material.positionNode = rotated.add(carPos)

  // --- body color + a touch of per-car roughness variation (paint wear / finish) ---
  material.colorNode = carColorNode(colorSeed)
  // small seeded roughness variation so the fleet is not uniform.
  material.roughnessNode = clamp(float(0.28).add(hash11(colorSeed.mul(7.3)).mul(0.22)), 0.18, 0.6)

  // --- head/tail lights: emissive that ramps on as daylight drops (night driving) ---
  // night factor: 1 at night, 0 in full day, with a dusk/dawn ramp.
  const night = smoothstep(0.55, 0.12, simUniforms.uDaylight)

  // Front cluster: local +Z near the nose, toward the two front corners, low on the body.
  const front = smoothstep(HALF_LEN * 0.55, HALF_LEN * 0.98, positionGeometry.z)
  const rear = smoothstep(HALF_LEN * -0.55, HALF_LEN * -0.98, positionGeometry.z)
  const sideMask = smoothstep(HALF_W * 0.2, HALF_W * 0.9, positionGeometry.x.abs()) // toward corners
  const lowOnBody = smoothstep(1.1, 0.45, positionGeometry.y) // headlamps sit low on the body

  const headOn = front.mul(sideMask).mul(lowOnBody).mul(night)
  const tailOn = rear.mul(sideMask).mul(lowOnBody).mul(night)

  const headlight = vec3(1.0, 0.96, 0.85).mul(headOn).mul(2.6) // warm white, bright
  const taillight = vec3(1.0, 0.06, 0.04).mul(tailOn).mul(1.6) // red
  material.emissiveNode = headlight.add(taillight)

  return { material, uSpeedScale }
}
