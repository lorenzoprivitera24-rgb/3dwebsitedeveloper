/**
 * Shared TSL building blocks for the city materials (shader engineer).
 *
 * These are renderer-agnostic node helpers: they compile to BOTH WGSL (WebGPU) and GLSL
 * (WebGL2). They deliberately avoid integer bit-ops (which can differ subtly between the two
 * backends) and texture lookups (no assets to download, mobile budget): everything here is the
 * classic sin/fract value-hash + value-noise, which is cheap and visually stable on both paths.
 *
 * They are plain functions that compose nodes (not wrapped in `Fn(...)`), so they inline into the
 * caller's graph and type-check cleanly under strict tsc. They are PURE functions of their inputs
 * (no `time`, no uniforms): callers combine them with `simUniforms` themselves, which keeps the
 * "single writer per uniform" rule intact — this module never reads or writes the sim uniforms.
 *
 * Conventions:
 *  - `hash11/hash21/hash31` return a float in [0,1) from a float / vec2 / vec3 seed.
 *  - `valueNoise2/3` are smooth [0,1) value noise (good for albedo/roughness wear).
 */
import type { Node } from 'three/webgpu'
import { float, vec2, vec3, floor, fract, sin, dot, mix } from 'three/tsl'

type FloatNode = Node<'float'>
type Vec2Node = Node<'vec2'>
type Vec3Node = Node<'vec3'>

/** 1D -> [0,1) value hash. Classic sin-fract; identical on WGSL and GLSL. */
export function hash11(p: FloatNode): FloatNode {
  return fract(sin(p.mul(127.1)).mul(43758.5453123)) as FloatNode
}

/** 2D -> [0,1) value hash. */
export function hash21(p: Vec2Node): FloatNode {
  const d = dot(p, vec2(127.1, 311.7))
  return fract(sin(d).mul(43758.5453123)) as FloatNode
}

/** 3D -> [0,1) value hash. */
export function hash31(p: Vec3Node): FloatNode {
  const d = dot(p, vec3(127.1, 311.7, 74.7))
  return fract(sin(d).mul(43758.5453123)) as FloatNode
}

/**
 * Smooth 2D value noise in [0,1). Bilinear blend of the four corner hashes with a smoothstep
 * fade. Cheap enough for per-fragment albedo/roughness wear on the mobile tier.
 */
export function valueNoise2(p: Vec2Node): FloatNode {
  const i = floor(p)
  const f = fract(p)
  // smoothstep fade: f*f*(3-2f)
  const u = f.mul(f).mul(float(3).sub(f.mul(2)))

  const a = hash21(i)
  const b = hash21(i.add(vec2(1, 0)))
  const c = hash21(i.add(vec2(0, 1)))
  const d = hash21(i.add(vec2(1, 1)))

  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) as FloatNode
}

/**
 * Smooth 3D value noise in [0,1). Trilinear blend of the eight corner hashes. Used for subtle
 * large-scale grime variation across facades/ground without a texture.
 */
export function valueNoise3(p: Vec3Node): FloatNode {
  const i = floor(p)
  const f = fract(p)
  const u = f.mul(f).mul(float(3).sub(f.mul(2)))

  const n000 = hash31(i.add(vec3(0, 0, 0)))
  const n100 = hash31(i.add(vec3(1, 0, 0)))
  const n010 = hash31(i.add(vec3(0, 1, 0)))
  const n110 = hash31(i.add(vec3(1, 1, 0)))
  const n001 = hash31(i.add(vec3(0, 0, 1)))
  const n101 = hash31(i.add(vec3(1, 0, 1)))
  const n011 = hash31(i.add(vec3(0, 1, 1)))
  const n111 = hash31(i.add(vec3(1, 1, 1)))

  const x00 = mix(n000, n100, u.x)
  const x10 = mix(n010, n110, u.x)
  const x01 = mix(n001, n101, u.x)
  const x11 = mix(n011, n111, u.x)
  const y0 = mix(x00, x10, u.y)
  const y1 = mix(x01, x11, u.y)
  return mix(y0, y1, u.z) as FloatNode
}
