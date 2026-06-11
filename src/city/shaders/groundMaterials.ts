/**
 * Ground / road / sidewalk materials (shader engineer, deliverable #3).
 *
 * All three are flat unit planes (normal +Y) scaled per-instance. As with the buildings, the
 * InstancedMesh path bakes the per-instance matrix into positionLocal, so `positionWorld` is in
 * meters and `modelScale` is identity. World-space patterns therefore tile coherently across the
 * whole city. The ROAD additionally reads a per-instance `aQuad = vec2(sizeX, sizeZ)` attribute so
 * it knows its run-axis (longer dimension) and short width — enough to draw a centered dashed lane
 * line along the road direction, in real meters, with no texture.
 *
 * Renderer-agnostic TSL (WGSL + GLSL). No textures: analytic value-noise wear only. These materials
 * do not read the sim uniforms (the sun light + fog already handle day/night on opaque ground); they
 * are deliberately uniform-free so there is nothing here for the motion engineer to drive.
 */
import type { Node } from 'three/webgpu'
import { MeshStandardNodeMaterial } from 'three/webgpu'
import {
  attribute,
  float,
  vec3,
  uv,
  positionWorld,
  fract,
  abs,
  mix,
  clamp,
  smoothstep,
  step,
  select,
} from 'three/tsl'
import { valueNoise2 } from './tslHelpers'

type FloatNode = Node<'float'>
type Vec2Node = Node<'vec2'>
type Vec3Node = Node<'vec3'>

// Lane marking geometry (meters)
const LANE_HALF_WIDTH = 0.11 // half-thickness of the painted line
const DASH_PERIOD = 7.0 // one dash + one gap
const DASH_DUTY = 0.42 // fraction of the period that is painted

/**
 * Asphalt road with a dashed centre line along the lane direction.
 * `aQuad` = [sizeX, sizeZ] (the instance's world footprint) tells us the run-axis.
 */
export function makeRoadMaterial(): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({ metalness: 0.0, roughness: 0.92 })

  const aQuad = attribute('aQuad', 'vec2') as unknown as Vec2Node
  const sizeX = aQuad.x as FloatNode
  const sizeZ = aQuad.y as FloatNode
  const runZ = step(sizeX, sizeZ) // 1 -> road runs along Z, 0 -> along X

  // --- asphalt base: dark, with broad patches + fine speckle, all world-space so tiles seamlessly
  const wear = valueNoise2(positionWorld.xz.mul(0.08)) // broad lighter/darker patches
  const speckle = valueNoise2(positionWorld.xz.mul(1.7)) // fine aggregate
  const asphalt = vec3(0.045, 0.05, 0.058)
    .add(wear.sub(0.5).mul(0.03))
    .add(speckle.sub(0.5).mul(0.015)) as Vec3Node
  const asphaltRough = clamp(float(0.9).add(wear.sub(0.5).mul(0.12)), 0.8, 0.98)

  // --- centre line (dashed) ---
  // across-road position in meters: pick the short axis; UV runs 0..1 across each axis.
  const perpUV = select(runZ.greaterThan(0.5), uv().x, uv().y)
  const shortSize = select(runZ.greaterThan(0.5), sizeX, sizeZ)
  const acrossMeters = perpUV.sub(0.5).mul(shortSize)
  // along-road world coordinate drives the dash pattern
  const alongWorld = select(runZ.greaterThan(0.5), positionWorld.z, positionWorld.x)

  // 1 inside the line, fading to 0 at the painted edge (soft, resolution-independent)
  const onLine = smoothstep(LANE_HALF_WIDTH * 0.7, LANE_HALF_WIDTH, abs(acrossMeters)).oneMinus()
  const dashPhase = fract(alongWorld.div(DASH_PERIOD))
  const onDash = step(dashPhase, float(DASH_DUTY))
  // a little wear on the paint itself so it is not pure white
  const paintWear = valueNoise2(positionWorld.xz.mul(0.5)).mul(0.18).add(0.8)
  const marking = onLine.mul(onDash)

  const paint = vec3(0.85, 0.82, 0.62).mul(paintWear) // warm worn-white centre line
  material.colorNode = mix(asphalt, paint, marking) as Vec3Node
  // wet-ish sheen on the asphalt, paint is matte
  material.roughnessNode = mix(asphaltRough, float(0.7), marking) as FloatNode

  return material
}

/** Sidewalk: paler, slightly rougher concrete with expansion-joint-scale wear. */
export function makeSidewalkMaterial(): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({ metalness: 0.0, roughness: 0.95 })

  const wear = valueNoise2(positionWorld.xz.mul(0.12))
  const grit = valueNoise2(positionWorld.xz.mul(2.3))
  const base = vec3(0.28, 0.28, 0.3)
    .add(wear.sub(0.5).mul(0.05))
    .add(grit.sub(0.5).mul(0.02)) as Vec3Node
  material.colorNode = base
  material.roughnessNode = clamp(float(0.95).add(wear.sub(0.5).mul(0.06)), 0.85, 1.0) as FloatNode
  return material
}

/** Ground slab under everything: darkest, low-frequency variation so the city edge reads as terrain. */
export function makeGroundMaterial(): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({ metalness: 0.0, roughness: 1.0 })
  const wear = valueNoise2(positionWorld.xz.mul(0.02))
  material.colorNode = vec3(0.05, 0.055, 0.05).add(wear.sub(0.5).mul(0.03)) as Vec3Node
  return material
}
