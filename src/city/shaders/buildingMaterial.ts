/**
 * Building facade material (shader engineer, deliverable #2).
 *
 * A procedural PBR facade: a window grid derived from WORLD-space position, per-instance variety
 * from `aFacade` = [facadeSeed, litBias], and the signature dusk shot — windows light up
 * progressively as `uDaylight` falls, with a per-window hash so they switch on at different times
 * and `litBias` raising/lowering each building's lit fraction. Fully driven by the sim uniforms, so
 * scrubbing the time-of-day slider animates the whole skyline lighting up / going dark.
 *
 * WHY WORLD SPACE (not object space): each archetype is a UNIT box scaled per-instance via the
 * InstancedMesh matrix. The TSL instancing path bakes that matrix into `positionLocal`, so the
 * mesh-level `modelScale` is identity and cannot tell us a building's real size. `positionWorld`
 * (= modelWorldMatrix * the instanced positionLocal) IS in meters, so window cells are a constant
 * real size on every building, and the whole skyline shares one coherent world lattice (still
 * jittered per building by facadeSeed). Vertical pitch uses world Y (base sits at Y=0); horizontal
 * pitch uses the world axis that varies across each face (z on X-facing faces, x on Z-facing faces).
 *
 * Renderer-agnostic (TSL only): compiles to WGSL and GLSL. No textures, all analytic hashing.
 * Reads (never writes) simUniforms: uTime (flicker), uDaylight (lit fraction + glass look).
 */
import type { Node } from 'three/webgpu'
import { MeshStandardNodeMaterial } from 'three/webgpu'
import {
  attribute,
  float,
  vec2,
  vec3,
  positionWorld,
  normalWorld,
  floor,
  fract,
  abs,
  mix,
  clamp,
  smoothstep,
  step,
  select,
  sin,
} from 'three/tsl'
import { simUniforms } from '../../sim/uniforms'
import { hash21, valueNoise3 } from './tslHelpers'
import type { BuildingArchetype } from '../types'

type FloatNode = Node<'float'>
type Vec2Node = Node<'vec2'>
type Vec3Node = Node<'vec3'>

interface ArchStyle {
  /** Floor-to-floor height in meters (vertical window pitch). */
  floorH: number
  /** Window bay width in meters (horizontal pitch). */
  bayW: number
  /** Fraction of the cell that is glass horizontally (0..1). */
  fillX: number
  /** Fraction of the cell that is glass vertically (0..1). */
  fillY: number
  /** Base wall albedo (daytime). */
  wall: [number, number, number]
  /** Baseline probability a window is lit at full night, before litBias. */
  baseLit: number
}

// Per-archetype proportions, tuned to read as different building types under the same sun.
const STYLES: Record<BuildingArchetype, ArchStyle> = {
  // chunky punched windows, warm masonry
  lowrise: { floorH: 3.6, bayW: 3.4, fillX: 0.62, fillY: 0.6, wall: [0.5, 0.46, 0.42], baseLit: 0.5 },
  // office-ish, regular grid, cooler concrete
  midrise: { floorH: 3.3, bayW: 3.0, fillX: 0.72, fillY: 0.66, wall: [0.46, 0.47, 0.5], baseLit: 0.42 },
  // tower: ribbon glazing, tall narrow bays, cool curtain wall
  tower: { floorH: 3.6, bayW: 2.4, fillX: 0.86, fillY: 0.78, wall: [0.34, 0.37, 0.43], baseLit: 0.34 },
}

// Warm interior light tints (sampled per window from a hash) — incandescent..neutral..cool office.
const LIT_WARM = vec3(1.0, 0.72, 0.42)
const LIT_NEUTRAL = vec3(1.0, 0.93, 0.78)
const LIT_COOL = vec3(0.82, 0.9, 1.0)

export function makeBuildingMaterial(archetype: BuildingArchetype): MeshStandardNodeMaterial {
  const s = STYLES[archetype]
  const material = new MeshStandardNodeMaterial({ metalness: 0.0, roughness: 0.85 })

  // per-instance facade data
  const aFacade = attribute('aFacade', 'vec2') as unknown as Vec2Node
  const facadeSeed = aFacade.x as FloatNode
  const litBias = aFacade.y as FloatNode

  // --- face frame from the world normal (axis-aligned boxes keep axis-aligned normals) ---
  const nAbsX = abs(normalWorld.x)
  const nAbsZ = abs(normalWorld.z)
  const isVertical = step(0.5, nAbsX.add(nAbsZ)) // 1 on side faces, 0 on top/bottom
  const faceIsX = step(nAbsZ, nAbsX) // 1 when this is an X-facing face

  // world meters across the face: on X-facing faces the position varies along Z, else along X
  const horizMeters = select(faceIsX.greaterThan(0.5), positionWorld.z, positionWorld.x)
  const heightMeters = positionWorld.y // base sits at world Y=0

  // per-instance jitter of the grid so adjacent buildings do not line up exactly
  const bayJitter = hash21(vec2(facadeSeed, 3.1)).mul(0.5).add(0.75) // 0.75..1.25
  const floorJitter = hash21(vec2(facadeSeed, 7.7)).mul(0.25).add(0.875) // 0.875..1.125
  const bayW = float(s.bayW).mul(bayJitter)
  const floorH = float(s.floorH).mul(floorJitter)
  // per-building phase shift so window columns are not globally in lock-step
  const phase = hash21(vec2(facadeSeed, 19.1)).mul(bayW)

  // cell coords: integer part = which window; fractional = position within the cell
  const colF = horizMeters.add(phase).div(bayW)
  const rowF = heightMeters.div(floorH)
  const col = floor(colF)
  const row = floor(rowF)
  const inCellX = fract(colF)
  const inCellY = fract(rowF)

  // ground floor band (lobby / shopfront): the first ~1.15 floors are solid, no residential glass
  const aboveGround = step(1.15, rowF)

  // glass mask: inside the glazed sub-rect of the cell, on a vertical face, above the ground band
  const halfX = float(s.fillX).mul(0.5)
  const halfY = float(s.fillY).mul(0.5)
  const inGlassX = step(abs(inCellX.sub(0.5)), halfX)
  const inGlassY = step(abs(inCellY.sub(0.5)), halfY)
  const glass = inGlassX.mul(inGlassY).mul(isVertical).mul(aboveGround)

  // unique per-window hash (stable per building + face + cell)
  const faceId = faceIsX.mul(2).add(step(0.0, normalWorld.x)).add(step(0.0, normalWorld.z))
  const cellSeed = vec2(col.add(faceId.mul(31.7)).add(facadeSeed.mul(101.3)), row)
  const cellHash = hash21(cellSeed)

  // --- lit fraction, driven by the day/night cycle ---
  // night rises as daylight falls; litBias + the archetype baseline scale how many windows light.
  const night = smoothstep(0.6, 0.05, simUniforms.uDaylight)
  const litFraction = clamp(float(s.baseLit).mul(litBias).mul(night).mul(1.25), 0, 1)
  // a window is lit if its hash falls under the (time-varying) lit fraction -> progressive switch-on
  const litBase = step(cellHash, litFraction)

  // subtle flicker for a few cells (interiors/TVs), tied to uTime so reduced-motion (which freezes
  // uTime) also freezes it. Only the ~8% "flickery" windows wobble, and only a little.
  const flickerSel = step(0.92, hash21(vec2(col.mul(1.3), row.mul(2.1).add(faceId))))
  const flick = sin(simUniforms.uTime.mul(6.0).add(cellHash.mul(40.0))).mul(0.5).add(0.5)
  const windowOn = litBase.mul(mix(float(1.0), mix(float(0.55), float(1.0), flick), flickerSel))

  // warm/neutral/cool interior tint, chosen by another hash bucket
  const tintH = hash21(vec2(col.add(7.0), row.sub(3.0).add(faceId)))
  const litTint = mix(
    LIT_WARM,
    select(tintH.greaterThan(0.5), LIT_COOL, LIT_NEUTRAL),
    smoothstep(0.25, 0.75, tintH),
  ) as Vec3Node

  // --- albedo: wall concrete with grime variation, glass darker/bluer ---
  const grime = valueNoise3(positionWorld.mul(0.06)).mul(0.18).add(0.91) // ~0.91..1.09
  const wallTint = hash21(vec2(facadeSeed, 12.4)).mul(0.12).sub(0.06) // +/-0.06 per-building shift
  const wallCol = vec3(...s.wall).add(wallTint).mul(grime) as Vec3Node
  const glassDayCol = vec3(0.06, 0.08, 0.12) // dark blue-grey daytime glazing
  material.colorNode = mix(wallCol, glassDayCol, glass) as Vec3Node

  // --- roughness: walls rough, glass smooth (clear PBR contrast under the sun) ---
  const wallRough = clamp(float(0.9).sub(grime.sub(1.0).mul(0.6)), 0.6, 1.0)
  material.roughnessNode = mix(wallRough, float(0.12), glass) as FloatNode
  // a touch of metalness on glass reads as a curtain-wall sheen in daylight reflections
  material.metalnessNode = glass.mul(0.25) as FloatNode

  // --- emissive: lit windows at night, varied warm tints, scaled by how "on" the window is ---
  const emissiveStrength = glass.mul(windowOn).mul(1.7)
  material.emissiveNode = litTint.mul(emissiveStrength) as Vec3Node

  return material
}
