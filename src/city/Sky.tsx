import { useMemo } from 'react'
import { BackSide, SphereGeometry } from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import type { Node } from 'three/webgpu'
import {
  float,
  vec3,
  positionLocal,
  dot,
  max,
  pow,
  mix,
  clamp,
  smoothstep,
  step,
  fract,
  floor,
} from 'three/tsl'
import { simUniforms } from '../sim/uniforms'
import { hash31 } from './shaders/tslHelpers'

type Vec3Node = Node<'vec3'>

/**
 * Sky + atmosphere (shader engineer, deliverable #4).
 *
 * A large origin-centred inverted dome rendered behind everything, with a fully procedural TSL
 * `colorNode` keyed off the SHARED sim uniforms (uSunDirection, uDaylight, uDayPhase). It gives a
 * day/night vertical gradient, a warm sun-glow lobe that turns golden at sunrise/sunset, and cheap
 * hash stars that fade in at night.
 *
 * OWNERSHIP / why a dome and not SkyMesh or scene.backgroundNode: the SimClockDriver is the single
 * writer of `scene.background` (a flat clear colour) and `scene.fog`. Taking over either would cross
 * that boundary. This dome is MY object: it draws in front of the flat background and is excluded
 * from fog, so nothing about the driver's contract changes. The dome is huge and centred at origin
 * (like jsm SkyMesh's scale.setScalar trick) so it needs NO per-frame transform update — it stays
 * outside the constrained orbit camera, so there is no third useFrame loop. It reads, never writes,
 * the sim uniforms.
 *
 * Renderer-agnostic TSL (WGSL + GLSL), no textures.
 */

// palette (linear-ish; ACES tone mapping is applied by the renderer)
const ZENITH_DAY = vec3(0.18, 0.34, 0.62)
const HORIZON_DAY = vec3(0.7, 0.8, 0.92)
const ZENITH_NIGHT = vec3(0.01, 0.015, 0.04)
const HORIZON_NIGHT = vec3(0.03, 0.05, 0.11)
const SUN_WARM = vec3(1.0, 0.55, 0.2) // low-sun glow
const SUN_WHITE = vec3(1.0, 0.95, 0.85) // high-sun glow

function skyColorNode(): Vec3Node {
  const dir = positionLocal.normalize() as Vec3Node // view direction on the dome
  const up = clamp(dir.y, 0, 1) // 0 at horizon, 1 at zenith
  const daylight = simUniforms.uDaylight

  // vertical gradient, blended between night and day palettes
  const dayGrad = mix(HORIZON_DAY, ZENITH_DAY, pow(up, float(0.55))) as Vec3Node
  const nightGrad = mix(HORIZON_NIGHT, ZENITH_NIGHT, pow(up, float(0.8))) as Vec3Node
  const baseSky = mix(nightGrad, dayGrad, daylight) as Vec3Node

  // sun glow: lobe around the sun direction
  const sunDir = simUniforms.uSunDirection
  const cosA = max(dot(dir, sunDir), 0.0)
  // tight disc + broad halo
  const disc = pow(cosA, float(800.0))
  const halo = pow(cosA, float(18.0))
  // goldenness: strongest when the sun is near the horizon (sunDir.y small) and it is daytime
  const lowSun = smoothstep(0.5, 0.0, sunDir.y.abs())
  const sunCol = mix(SUN_WHITE, SUN_WARM, lowSun) as Vec3Node
  // glow only contributes while the sun is above the horizon (fade across daylight)
  const sunVisible = smoothstep(0.0, 0.18, daylight)
  const glow = sunCol.mul(halo.mul(0.6).add(disc.mul(3.0))).mul(sunVisible) as Vec3Node

  // horizon haze warms toward the sun's azimuth at golden hour
  const horizonBand = smoothstep(0.22, 0.0, up)
  const haze = sunCol.mul(horizonBand.mul(lowSun).mul(sunVisible).mul(0.35)) as Vec3Node

  // stars: cheap 3D directional cell hash (uniform over the sphere, no projection distortion),
  // upper hemisphere only, faded out by daylight. Quantise the view direction into cells and light
  // a sparse subset; a soft point sits near each cell centre.
  const starGrid = dir.mul(140.0)
  const cell = floor(starGrid)
  const f = fract(starGrid).sub(0.5)
  const starHash = hash31(cell)
  const isStar = step(0.99, starHash) // ~1% of cells get a star
  const pointFalloff = smoothstep(0.4, 0.0, f.length())
  const twinkle = hash31(cell.add(vec3(3.7, 1.1, 9.2))).mul(0.5).add(0.5)
  const nightFactor = smoothstep(0.35, 0.0, daylight)
  const starUpMask = smoothstep(0.04, 0.22, dir.y) // no stars at the very horizon
  const stars = isStar
    .mul(pointFalloff)
    .mul(twinkle)
    .mul(nightFactor)
    .mul(starUpMask)
    .mul(1.6)

  return baseSky.add(glow).add(haze).add(vec3(0.9, 0.93, 1.0).mul(stars)) as Vec3Node
}

export function Sky({ radius }: { radius: number }) {
  const geometry = useMemo(() => new SphereGeometry(radius, 32, 16), [radius])
  const material = useMemo(() => {
    const m = new MeshBasicNodeMaterial()
    m.side = BackSide
    m.depthWrite = false
    m.fog = false // the dome is the sky; scene fog must not tint it
    m.colorNode = skyColorNode()
    return m
  }, [])

  return (
    <mesh geometry={geometry} material={material} renderOrder={-1} frustumCulled={false} name="sky" />
  )
}
