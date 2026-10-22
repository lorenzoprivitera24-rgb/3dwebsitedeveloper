import * as THREE from 'three/webgpu'
import { Canvas, extend, useFrame, useThree, type ThreeToJSXElements } from '@react-three/fiber'
import { Component, Suspense, useEffect, useLayoutEffect, type ReactNode } from 'react'
import { Poster } from './Poster'
import { DevPerf } from './DevPerf'
import { proteggiIndici } from './indiciWebGL'
import { rigeneraPmrem, rinfrescaAmbiente, seguiScena } from './pmremRigenerato'
import {
  PARACADUTE_MS,
  accendiCompilazioneParallela,
  leggiFotogramma,
  presentaScena,
  rivelazione,
} from './compilazioneParallela'

// Make the WebGPU build's primitives and node materials available as JSX elements.
declare module '@react-three/fiber' {
  // Canonical R3F v9 augmentation: the "empty" interface IS the declaration merge.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ThreeElements extends ThreeToJSXElements<typeof THREE> {}
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
extend(THREE as any)

// If the renderer crashes at runtime (very old GPU, driver bug), show the poster instead of a blank canvas.
class CanvasErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch(error: unknown) {
    console.error('Canvas failed, falling back to poster:', error)
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children
  }
}

/** La dissolvenza con cui la tela compare (portata da SILKET); niente con prefers-reduced-motion. */
const DISSOLVENZA_S = 0.35

function mostra(tela: HTMLCanvasElement, motivo: string, anomalo = false) {
  rivelazione.attesa = false
  tela.style.opacity = ''
  const ms = Math.round(performance.now() - rivelazione.dal)
  // letto da qa:parallela: il tempo alla scena intera, e se ci è arrivata o è scattato il paracadute
  ;(anomalo ? console.warn : console.info)(`[kit] tela rivelata a ${ms} ms: ${motivo}`)
}

/**
 * La seconda metà della cura del PMREM (pmremRigenerato.ts): dal three r186 un HDRI smaltito e
 * rigenerato non arriva agli oggetti fermi senza un refresh completo dei binding, che qui si forza al
 * fotogramma dopo la dispose. useFrame a -3: prima di Rivelazione e del render, senza possederlo.
 */
function RinfrescoAmbiente() {
  const scena = useThree((s) => s.scene)
  useLayoutEffect(() => seguiScena(scena), [scena])
  useFrame(() => rinfrescaAmbiente(), -3)
  return null
}

/**
 * Mostra la tela al primo fotogramma completo (vedi compilazioneParallela.ts). Non possiede il
 * render, che resta di R3F (o di PostFX a priorità 1): il suo useFrame gira a priorità -2, negativa,
 * e quindi non spegne l'auto-render, e giudica il fotogramma PRECEDENTE, già presentato, dal conto
 * degli oggetti della scena che quel render ha disegnato o saltato. Gira prima di Riscaldamento
 * (-1), i cui render nel bersaglio gemello restano comunque fuori conto (`fuoriConto`). Il
 * paracadute è un timer e non il ciclo: regge anche se il ciclo non gira.
 */
function Rivelazione() {
  const gl = useThree((s) => s.gl)
  const scena = useThree((s) => s.scene)
  // Un layout effect gira prima del primo fotogramma: R3F non disegna finché il suo Provider non
  // ha montato, e i figli montano prima del padre.
  useLayoutEffect(() => {
    presentaScena(scena)
    return () => presentaScena(null)
  }, [scena])

  useEffect(() => {
    if (!rivelazione.attesa) return
    const resta = Math.max(0, PARACADUTE_MS - (performance.now() - rivelazione.dal))
    const t = window.setTimeout(() => {
      if (!rivelazione.attesa) return
      const { disegnati, saltati } = leggiFotogramma()
      mostra(gl.domElement, `paracadute (nell'ultimo conto ${disegnati} disegnati, ${saltati} saltati)`, true)
    }, resta)
    return () => window.clearTimeout(t)
  }, [gl])

  useFrame(() => {
    if (!rivelazione.attesa) return
    const { disegnati, saltati } = leggiFotogramma()
    if (disegnati > 0 && saltati === 0) mostra(gl.domElement, `fotogramma completo (${disegnati} oggetti)`)
  }, -2)

  return null
}

interface StageProps {
  children: ReactNode
  dpr: [number, number]
  /** Artistic exposure dial for the house tonemapper (AgX). 1 = neutral. */
  toneMappingExposure?: number
  /** Punto di partenza della camera (poi il suo owner la muove). Default: la demo (0,0,6). */
  cameraPosition?: [number, number, number]
  cameraFov?: number
}

export function Stage({ children, dpr, toneMappingExposure = 1, cameraPosition = [0, 0, 6], cameraFov = 45 }: StageProps) {
  return (
    <CanvasErrorBoundary fallback={<Poster />}>
      <Canvas
        // R3F v9: the gl prop may return a Promise, which lets WebGPURenderer await init().
        // WebGPURenderer.init() falls back to WebGL2 automatically when WebGPU is unavailable.
        gl={async (props) => {
          // AA decision (verified): antialias:true → WebGPURenderer samples=4, and the scene
          // PassNode honors it, so MSAA also multisamples the off-screen pass when post FX
          // arrives. Swap to SMAA/TRAA in post only when shader/alpha aliasing dominates —
          // never hardcode antialias:false "because post".
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const renderer = new THREE.WebGPURenderer({ ...(props as any), antialias: true })
          await renderer.init()
          // Su WebGL2 con KHR_parallel_shader_compile i programmi della scena si compilano senza
          // fermare la pagina (compilazioneParallela.ts: su un iPhone con iOS 18 è la differenza
          // fra una pagina ferma per secondi e una che gira). Un oggetto in volo viene saltato.
          const compilazione = accendiCompilazioneParallela(renderer)
          // Sul ripiego WebGL2 un oggetto che carica i suoi indici e poi non viene disegnato
          // (programma in volo, zero istanze) toglie gli indici al VAO dell'oggetto disegnato
          // prima: difetto di three r185, cura e misure in indiciWebGL.ts. Su WebGPU non fa niente.
          const indici = proteggiIndici(renderer)
          // Su ogni motore un HDRI smaltito (drei lo fa allo smontaggio di <Environment>, e lo
          // StrictMode del dev subito dopo il montaggio) lascerebbe l'IBL nero per sempre: difetto
          // di three r185, cura e misure in pmremRigenerato.ts. Prima del primo render.
          const pmrem = rigeneraPmrem()
          // Su ogni motore la tela nasce trasparente e la mostra <Rivelazione> al primo
          // fotogramma completo: niente scena a pezzi mentre i programmi arrivano.
          if (compilazione !== 'interni-mancanti') {
            const tela = renderer.domElement
            const calmo = window.matchMedia('(prefers-reduced-motion: reduce)').matches
            tela.style.transition = calmo ? 'none' : `opacity ${DISSOLVENZA_S}s ease-out`
            tela.style.opacity = '0'
            rivelazione.attesa = true
            rivelazione.dal = performance.now()
          }
          // House output transform: AgX tonemapping (neutral filmic highlights; ACESFilmic is
          // the documented alternative) + exposure as the one artistic dial. Set AFTER init().
          renderer.toneMapping = THREE.AgXToneMapping
          renderer.toneMappingExposure = toneMappingExposure
          // True backend flag: renderer.isWebGPURenderer stays true even on the WebGL2
          // fallback; only backend.isWebGPUBackend tells the truth. Logged for verification
          // (browser QA reads this instead of guessing from visuals).
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const backend = (renderer as any).backend
          console.info('[kit] renderer backend:', backend?.isWebGPUBackend ? 'WebGPU' : 'WebGL2')
          // Letto da qa:indici: una cura che three ha reso inapplicabile non deve passare in silenzio.
          if (indici === 'interni-mancanti') {
            console.warn('[kit] indici WebGL2: interni-mancanti (three ha cambiato WebGLAttributeUtils: riverificare il difetto, vedi indiciWebGL.ts)')
          } else {
            console.info('[kit] indici WebGL2:', indici)
          }
          // Letto da qa:ibl: una cura che three ha reso inapplicabile non deve passare in silenzio.
          if (pmrem === 'interni-mancanti') {
            console.warn('[kit] pmrem: interni-mancanti (three ha cambiato PMREMGenerator: riverificare il difetto, vedi pmremRigenerato.ts)')
          } else {
            console.info('[kit] pmrem:', pmrem)
          }
          // Letto da qa:parallela e qa:indici: con quale compilazione ha girato la pagina.
          if (compilazione === 'interni-mancanti') {
            console.warn('[kit] compilazione WebGL2: interni-mancanti (three ha cambiato Pipelines: niente compilazione in parallelo né rivelazione, vedi compilazioneParallela.ts)')
          } else {
            console.info('[kit] compilazione WebGL2:', compilazione)
          }
          return renderer
        }}
        camera={{ position: cameraPosition, fov: cameraFov }}
        dpr={dpr}
      >
        <Suspense fallback={null}>{children}</Suspense>
        <Rivelazione />
        <RinfrescoAmbiente />
        <DevPerf />
      </Canvas>
    </CanvasErrorBoundary>
  )
}
