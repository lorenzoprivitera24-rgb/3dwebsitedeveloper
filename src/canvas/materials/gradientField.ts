// Mesh gradient TSL parametrico (ricetta della skill tsl-gradient-cookbook): tre colori dai
// token + rumore MaterialX, pointer-aware. Un solo materiale condiviso, uniform esposte.
//
// I parametri di resa NON sono più costanti nel sorgente: arrivano da looks/03-gradient.json e
// vivono come uniform, così il pannello Leva (dev) li muove a scena viva. Vedi looks/README.md:
// se un valore si accorda a occhio, sta nel JSON e ha una manopola.
import { Color, Vector2 } from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import { Fn, uniform, uv, vec3, mix, time, mx_noise_float } from 'three/tsl'
import { TOKENS } from '../../lib/tokens.generated'

export interface GradientLook {
  /** quante volte il campo si ripete sullo schermo */
  noiseScale: number
  /** quanto il puntatore trascina il campo */
  pointerInfluence: number
  /** scala del secondo strato di rumore (le vene) */
  detailScale: number
  /** sfasamento temporale del secondo strato, evita che i due battano insieme */
  detailOffset: number
  /** ampiezza del mix colorA→colorB */
  baseSpread: number
  /** MEDIA del mix colorA→colorB: è questo numero a decidere se la scena è notte o giorno */
  baseBias: number
  /** ampiezza delle vene di colorC */
  veinSpread: number
  /** MEDIA delle vene */
  veinBias: number
}

export function makeGradientFieldMaterial(look: GradientLook) {
  const uMix = uniform(0) // presenza del campo (opacity), damped dal GradientBackdrop
  const uFlow = uniform(TOKENS.gradient.flow)
  const uPointer = uniform(new Vector2(0, 0))
  const colorA = uniform(new Color(TOKENS.gradient.a))
  const colorB = uniform(new Color(TOKENS.gradient.b))
  const colorC = uniform(new Color(TOKENS.gradient.c))

  // Le manopole. Scalari: il costo rispetto alle costanti è trascurabile, e in cambio si accordano
  // senza ricompilare lo shader.
  const uNoiseScale = uniform(look.noiseScale)
  const uPointerInfluence = uniform(look.pointerInfluence)
  const uDetailScale = uniform(look.detailScale)
  const uDetailOffset = uniform(look.detailOffset)
  const uBaseSpread = uniform(look.baseSpread)
  const uBaseBias = uniform(look.baseBias)
  const uVeinSpread = uniform(look.veinSpread)
  const uVeinBias = uniform(look.veinBias)

  const material = new MeshBasicNodeMaterial()
  material.transparent = true
  material.depthWrite = false

  material.colorNode = Fn(() => {
    const p = uv().mul(uNoiseScale).add(uPointer.mul(uPointerInfluence))
    const n1 = mx_noise_float(vec3(p, time.mul(uFlow)))
    const n2 = mx_noise_float(vec3(p.mul(uDetailScale), time.mul(uFlow).add(uDetailOffset)))
    // .rgb porta i nodi 'color' a 'vec3' (vec3(colorNode) rompe i generics dei types r184)
    // Dominante SCURA con vene di colore (QA giri 1-2): mx_noise vive in un range stretto
    // attorno a 0, quindi la MEDIA del mix decide tutto — il bias tiene la notte della
    // direction, il clamp evita l'estrapolazione di mix() sotto 0.
    const base = mix(colorA.rgb, colorB.rgb, n1.mul(uBaseSpread).add(uBaseBias).clamp(0, 1))
    return mix(base, colorC.rgb, n2.mul(uVeinSpread).add(uVeinBias).clamp(0, 1))
  })()

  material.opacityNode = uMix

  const lookUniforms = {
    noiseScale: uNoiseScale,
    pointerInfluence: uPointerInfluence,
    detailScale: uDetailScale,
    detailOffset: uDetailOffset,
    baseSpread: uBaseSpread,
    baseBias: uBaseBias,
    veinSpread: uVeinSpread,
    veinBias: uVeinBias,
  }

  return { material, uniforms: { uMix, uFlow, uPointer }, lookUniforms }
}

export type GradientLookUniforms = ReturnType<typeof makeGradientFieldMaterial>['lookUniforms']
