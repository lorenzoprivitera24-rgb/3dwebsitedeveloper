// Il ponte QA: l'unico punto in cui il kit si lascia interrogare da fuori (`window.__qa`).
//
// PERCHÉ ESISTE — il gate di stato (scripts/state-gate.mjs) è l'unico dei tre gate del kit che
// sia DETERMINISTICO al 100%: non tocca la GPU, non confronta pixel, non misura tempo. Asserisce
// sui numeri del contratto a due livelli (progressMap → sceneTargets → uniform/camera), che sono
// pura JS. Lo screenshot ha bisogno di soglie percettive e di una GPU vera (headless Chrome non
// presenta il canvas WebGPU al compositore: lo scatto riesce ma è nero); il frame time ha bisogno
// di statistica. Questo no: o il numero converge o non converge.
//
// COSA SI PUÒ ASSERIRE E COSA NO — il damping (`MathUtils.damp`) è indipendente dal framerate,
// quindi il VALORE DI ARRIVO è deterministico ma la TRAIETTORIA no (i delta reali variano). Per
// questo il gate asserisce sulla CONVERGENZA dopo N frame di assestamento, mai sul transitorio.
//
// Il ponte è inerte finché non lo si arma con `?qa=1`: in pagina normale non installa nulla.
import { progressMap } from '../scroll/progressMap'
import { sceneTargets } from './../canvas/sceneState'
import { qaProbes } from './registry'

export interface QaState {
  progressMap: Record<string, number>
  sceneTargets: Record<string, number>
  camera: { x: number; y: number; z: number; fov: number; aspect: number }
  probes: Record<string, number | number[]>
  render: { calls: number; triangles: number; geometries: number; textures: number }
  backend: 'WebGPU' | 'WebGL2' | 'unknown'
  dpr: number
  reduced: boolean
  frame: number
}

export interface QaApi {
  version: 1
  /** true quando ENTRAMBE le metà (DOM e scena) si sono registrate */
  ready: boolean
  /** id delle sezioni note a ScrollTrigger */
  sections: () => string[]
  /** porta lo scroll al punto `p` (0..1) della sezione `id`; false se il trigger non esiste */
  scrubToSection: (id: string, p: number) => boolean
  /** attende N frame renderizzati (il damping converge, non si indovina un timeout) */
  settle: (frames?: number) => Promise<void>
  /** istantanea numerica dello stato */
  state: () => QaState
  /** delta per frame in ms su N frame: mediana e p95 li calcola il gate, non la pagina */
  frameSamples: (n?: number) => Promise<number[]>
}

declare global {
  interface Window {
    __qa?: QaApi
  }
}

/** Armato solo con ?qa=1 — in pagina normale il ponte non esiste. */
export function qaEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('qa') === '1'
}

type SceneHalf = {
  settle: (frames: number) => Promise<void>
  frameSamples: (n: number) => Promise<number[]>
  snapshot: () => Omit<QaState, 'progressMap' | 'sceneTargets' | 'probes' | 'reduced'>
}
type DomHalf = {
  sections: () => string[]
  scrubToSection: (id: string, p: number) => boolean
}

let sceneHalf: SceneHalf | null = null
let domHalf: DomHalf | null = null

const notReady = (): never => {
  throw new Error('[qa] ponte non pronto: manca la metà scena o la metà DOM')
}

function install() {
  if (typeof window === 'undefined') return
  window.__qa = {
    version: 1,
    get ready() {
      return sceneHalf !== null && domHalf !== null
    },
    sections: () => domHalf?.sections() ?? notReady(),
    scrubToSection: (id, p) => domHalf?.scrubToSection(id, p) ?? notReady(),
    settle: (frames = 150) => sceneHalf?.settle(frames) ?? notReady(),
    frameSamples: (n = 120) => sceneHalf?.frameSamples(n) ?? notReady(),
    state: () => {
      const s = sceneHalf?.snapshot() ?? notReady()
      const probes: Record<string, number | number[]> = {}
      for (const [k, get] of Object.entries(qaProbes)) probes[k] = get()
      return {
        ...s,
        progressMap: { ...progressMap },
        sceneTargets: { ...sceneTargets },
        probes,
        reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      }
    },
  }
}

export function registerSceneHalf(half: SceneHalf): () => void {
  sceneHalf = half
  install()
  return () => {
    sceneHalf = null
  }
}

export function registerDomHalf(half: DomHalf): () => void {
  domHalf = half
  install()
  return () => {
    domHalf = null
  }
}
