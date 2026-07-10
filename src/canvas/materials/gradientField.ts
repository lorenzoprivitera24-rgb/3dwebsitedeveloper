// Mesh gradient TSL parametrico (ricetta della skill tsl-gradient-cookbook): tre colori dai
// token + rumore MaterialX, pointer-aware. Un solo materiale condiviso, uniform esposte.
import { Color, Vector2 } from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import { Fn, uniform, uv, vec3, mix, time, mx_noise_float } from 'three/tsl'
import { TOKENS } from '../../lib/tokens.generated'

export function makeGradientFieldMaterial() {
  const uMix = uniform(0) // presenza del campo (opacity), damped dal GradientBackdrop
  const uFlow = uniform(TOKENS.gradient.flow)
  const uPointer = uniform(new Vector2(0, 0))
  const colorA = uniform(new Color(TOKENS.gradient.a))
  const colorB = uniform(new Color(TOKENS.gradient.b))
  const colorC = uniform(new Color(TOKENS.gradient.c))

  const material = new MeshBasicNodeMaterial()
  material.transparent = true
  material.depthWrite = false

  material.colorNode = Fn(() => {
    const p = uv().mul(3.0).add(uPointer.mul(0.4))
    const n1 = mx_noise_float(vec3(p, time.mul(uFlow)))
    const n2 = mx_noise_float(vec3(p.mul(2.0), time.mul(uFlow).add(7.0)))
    // .rgb porta i nodi 'color' a 'vec3' (vec3(colorNode) rompe i generics dei types r184)
    const base = mix(colorA.rgb, colorB.rgb, n1.mul(0.5).add(0.5))
    return mix(base, colorC.rgb, n2.mul(0.25).add(0.25))
  })()

  material.opacityNode = uMix

  return { material, uniforms: { uMix, uFlow, uPointer } }
}
