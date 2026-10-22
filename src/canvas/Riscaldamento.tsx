// ─────────────────────────────────────────────────────────────────────────────
// Riscaldamento.tsx: i programmi GPU di TUTTA la scena si compilano prima che chi scorre ci arrivi.
//
// Un materiale compila il suo programma la prima volta che si VEDE. Un oggetto che nasce
// invisibile (il satellite del blueprint 04, un mondo che entra al suo capitolo) lo compila nel
// fotogramma in cui entra in quadro, cioè sotto il dito. Su un Mac costa un paio di ms; su un
// iPhone col ripiego WebGL2 la traduzione GLSL → Metal costa cento volte tanto (SILKET, 24 set
// 2026: 157 programmi = ~30 s di pagina ferma, blocchi da 150 ms a 1,3 s dentro il gesto). Sulla
// demo del kit, 21 ott 2026, `qa:compilazioni` a caricamento finito: scorrendo nascevano 1
// programma (WebKit, WebGL2) e 2 pipeline (Chromium, WebGPU), tutti all'80% della pagina, dove
// compare il satellite.
//
// Portato da SILKET (`PreRiscaldamento`, src/world/MondoSilket.tsx, 6 ago → 21 ott 2026), con le
// regole che lì sono costate una misura ciascuna:
//  1. `compileAsync(scene)` non basta: come il render salta gli invisibili e i fuori quadro, cioè
//     proprio quelli che servono. Si disegna un SOSTITUTO per ogni coppia (geometria, materiale)
//     delle mesh semplici, che condivide gli oggetti veri senza copiarli, e poi ogni figlio della
//     scena intero coi discendenti accesi. Le InstancedMesh non si sostituiscono: three incide nel
//     sorgente nome e taglia del buffer delle matrici, una copia scalderebbe un programma diverso.
//  2. Il bersaglio è GEMELLO del frame buffer di three: attaccamenti e spazio colore entrano nelle
//     chiavi di programmi e pipeline, e un `new RenderTarget(8, 8)` di default ne scalda altri, che
//     il sito non usa mai (SILKET, 23 set: 85 programmi nascevano scorrendo lo stesso).
//  3. Una coda a budget, mai un blocco: a scena ferma più compiti per fotogramma entro `BUDGET_MS`,
//     scorrendo uno solo, e comunque al più UN programma nuovo per fotogramma. In WebKit ogni
//     domanda al processo GPU aspetta dietro i link lanciati prima: con più link insieme le attese
//     salivano da 7 a 159-654 ms (SILKET, 21 ott).
//  4. Ogni render di compito ha un `frameId` suo (`nodeFrame.update()`, ciò che il ciclo di three
//     fa a ogni rAF). L'ombra si ridisegna al più una volta per frameId: così ogni compito si prende
//     la sua passata d'ombra e ne compila le pipeline, e il render vero che segue la ridisegna intera.
//
// Differenze da SILKET. Il consumatore gira a priorità -1, dopo la sola rivelazione di Stage (-2, che
// non disegna), e NON possiede il render: nel kit lo presenta R3F (o PostFX). Dopo l'ultimo compito
// un `frameId` nuovo lascia al render vero la sua passata d'ombra, e le luci con l'ombra su
// richiesta (`shadow.autoUpdate = false`) se la vedono chiedere di nuovo. I ripassi rifanno la coda
// anche quando cambia ciò che entra nel programma a livello di scena (ambiente, nebbia, luci):
// l'HDRI arriva dopo il primo ripasso.
//
// Con la compilazione in parallelo (compilazioneParallela.ts, WebGL2 con l'estensione) un compito
// non aspetta il programma: ne lancia il link, e il render vero salta l'oggetto finché non è pronto.
// La regola 3 resta, perché in WebKit le domande al processo GPU fanno la coda dietro i link. I
// render dei compiti stanno fuori dal conto della rivelazione (`fuoriConto`): un oggetto saltato nel
// bersaglio gemello non dice niente del fotogramma che arriva a schermo.
//
// Limite dichiarato: con PostFX il render vero passa dal bersaglio MRT del PassNode, un ALTRO
// contesto, e i programmi scaldati qui non sono quelli. Lo dice `qa:compilazioni`, che è anche la
// verifica di questo file: zero programmi nati scorrendo, su WebKit e su Chromium.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { ColorManagement, Group, Mesh, RGBAFormat, RenderTarget } from 'three'
import type { Camera, ColorSpace, Light, Material, Object3D, TextureDataType } from 'three'
import { progressMap, type SectionKey } from '../scroll/progressMap'
import { pointerSignal } from '../lib/pointerRef'
import { fuoriConto } from './compilazioneParallela'

/** Millisecondi di compiti in un fotogramma a scena ferma, oltre al primo compito. */
const BUDGET_MS = 8
/** Quando si raccoglie la scena: alcune mesh nascono dentro effetti, l'HDRI arriva dopo. */
const RIPASSI_MS = [500, 2500, 6000]
/** Ciò che muove la scena: se nessuno cambia fra due fotogrammi, la scena è ferma. */
const CANALI = Object.keys(progressMap) as SectionKey[]

interface RendererInterno {
  setRenderTarget: (t: RenderTarget | null) => void
  getRenderTarget: () => RenderTarget | null
  render: (scena: Object3D, camera: Camera) => void
  getOutputBufferType: () => TextureDataType
  samples: number
  depth: boolean
  stencil: boolean
  needsFrameBufferTarget?: boolean
  _nodes?: { nodeFrame?: { update?: () => void } }
  _pipelines?: { caches?: Map<unknown, unknown> }
}

type LuceConOmbra = Light & { shadow?: { autoUpdate: boolean; needsUpdate: boolean } }

/**
 * Un `frameId` nuovo per il render che segue, come quello che il ciclo di three assegna a ogni rAF
 * (`Animation` chiama `nodeFrame.update()`). Il tempo dei nodi resta giusto: `update()` somma il
 * delta trascorso. API interna di three r185: se manca risponde `false` e la coda fa un compito per
 * fotogramma.
 */
function nuovoFotogramma(r: RendererInterno): boolean {
  const nodeFrame = r._nodes?.nodeFrame
  if (typeof nodeFrame?.update !== 'function') return false
  nodeFrame.update()
  return true
}

/** Quante pipeline ha fatto nascere il renderer finora (`Pipelines.caches`), o -1 se non si sa. */
function pipelineNate(r: RendererInterno): number {
  const caches = r._pipelines?.caches
  return caches instanceof Map ? caches.size : -1
}

export function Riscaldamento() {
  const gl = useThree((s) => s.gl)
  const scena = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  // La coda vive fuori dall'effetto: la riempiono i ripassi, la svuota useFrame.
  const coda = useRef<(() => void)[]>([])
  const luciSuRichiesta = useRef<LuceConOmbra[]>([])
  const ultimi = useRef(new Float64Array(CANALI.length + 2))

  useEffect(() => {
    const r = gl as unknown as RendererInterno
    let vivo = true
    const bersaglio = new RenderTarget(8, 8, {
      depthBuffer: r.depth,
      stencilBuffer: r.stencil,
      type: r.getOutputBufferType(),
      format: RGBAFormat,
      colorSpace: ColorManagement.workingColorSpace as ColorSpace,
      samples: r.samples,
    })
    if (r.needsFrameBufferTarget === false) {
      console.warn('[kit] riscaldamento: il render non passa dal frame buffer di three, i programmi scaldati non saranno quelli veri')
    }
    // Vive FUORI dai ripassi: ognuno accoda solo ciò che è nato (o cambiato) nel frattempo.
    const visti = new Set<string>()
    const lista = coda.current
    lista.length = 0

    /** Spegne tutti i figli della scena tranne le luci e `acceso`; ritorna come rimetterli. */
    const soloQuesto = (acceso: Object3D) => {
      const spenti: Object3D[] = []
      for (const figlio of scena.children) {
        if ((figlio as Light).isLight || figlio === acceso || !figlio.visible) continue
        figlio.visible = false
        spenti.push(figlio)
      }
      return () => {
        for (const o of spenti) o.visible = true
      }
    }

    /** Un render al buio e in piccolo, nel bersaglio gemello, fuori dal conto della rivelazione. */
    const disegna = () => {
      const prima = r.getRenderTarget()
      try {
        r.setRenderTarget(bersaglio)
        fuoriConto(() => r.render(scena, camera))
      } catch {
        // un riscaldamento che fallisce non rompe il sito
      } finally {
        r.setRenderTarget(prima)
      }
    }

    /** Un sostituto per ogni coppia (geometria, materiale) delle mesh semplici. */
    const sostitutiDi = (radice: Object3D, firma: string) => {
      radice.traverse((o) => {
        const mesh = o as Mesh
        const mat = mesh.material as Material | Material[] | undefined
        // solo le Mesh semplici: istanziate, scheletri, punti e linee li scalda il compito intero
        if (o.type !== 'Mesh' || !mat || Array.isArray(mat) || !mesh.geometry) return
        const chiave = `${firma}|${mat.uuid}|${mesh.geometry.uuid}`
        if (visti.has(chiave)) return
        visti.add(chiave)
        lista.push(() => {
          const sostituto = new Mesh(mesh.geometry, mat)
          // le ombre hanno pipeline proprie: il sostituto dichiara le stesse dell'originale
          sostituto.castShadow = o.castShadow
          sostituto.receiveShadow = o.receiveShadow
          sostituto.frustumCulled = false
          const gruppo = new Group()
          gruppo.add(sostituto)
          scena.add(gruppo)
          const ripristina = soloQuesto(gruppo)
          disegna()
          ripristina()
          scena.remove(gruppo)
          gruppo.clear()
        })
      })
    }

    /** Il figlio intero coi discendenti accesi e mai scartati: copre ciò che i sostituti no. */
    const compitoIntero = (figlio: Object3D, firma: string) => {
      let discendenti = 0
      figlio.traverse(() => {
        discendenti++
      })
      const chiave = `${firma}|${figlio.uuid}|${discendenti}`
      if (visti.has(chiave)) return
      visti.add(chiave)
      lista.push(() => {
        const eraVisibile = figlio.visible
        const scartabili: Object3D[] = []
        const nascosti: Object3D[] = []
        figlio.visible = true
        figlio.traverse((o) => {
          if (o.frustumCulled) {
            o.frustumCulled = false
            scartabili.push(o)
          }
          if (!o.visible) {
            o.visible = true
            nascosti.push(o)
          }
        })
        const ripristina = soloQuesto(figlio)
        disegna()
        ripristina()
        for (const o of scartabili) o.frustumCulled = true
        for (const o of nascosti) o.visible = false
        figlio.visible = eraVisibile
      })
    }

    /** Nell'ordine della scena, cioè del JSX e del viaggio: un figlio alla volta, intero. */
    const raccogli = () => {
      const luci: LuceConOmbra[] = []
      scena.traverse((o) => {
        const l = o as LuceConOmbra
        if (l.isLight) luci.push(l)
      })
      luciSuRichiesta.current = luci.filter((l) => l.castShadow && l.shadow && !l.shadow.autoUpdate)
      // ciò che entra nel programma a livello di scena: se cambia, si riscalda tutto
      const ambiente = scena.environment as { uuid?: string } | null
      const firma = `${ambiente?.uuid ?? '-'}|${scena.fog ? 'nebbia' : '-'}|${luci.length}`
      for (const figlio of scena.children) {
        if ((figlio as Light).isLight) continue
        sostitutiDi(figlio, firma)
        compitoIntero(figlio, firma)
      }
    }

    const timer = RIPASSI_MS.map((ms) =>
      setTimeout(() => {
        if (vivo) raccogli()
      }, ms),
    )
    return () => {
      vivo = false
      for (const t of timer) clearTimeout(t)
      lista.length = 0
      bersaglio.dispose()
    }
  }, [gl, scena, camera])

  // Priorità -1: prima di ogni altro useFrame e del render vero, che resta di R3F (o di PostFX).
  useFrame((state) => {
    const lista = coda.current
    if (!lista.length) return
    // ferma = nessun canale dello scroll e nessun puntatore è cambiato dal fotogramma prima
    const u = ultimi.current
    let mossa = false
    for (let i = 0; i < CANALI.length; i++) {
      const v = progressMap[CANALI[i]]
      if (v !== u[i]) {
        u[i] = v
        mossa = true
      }
    }
    const n = CANALI.length
    if (pointerSignal.x !== u[n] || pointerSignal.y !== u[n + 1]) {
      u[n] = pointerSignal.x
      u[n + 1] = pointerSignal.y
      mossa = true
    }
    const r = state.gl as unknown as RendererInterno
    const luci = luciSuRichiesta.current
    const chiediOmbra = () => {
      for (const l of luci) if (l.shadow) l.shadow.needsUpdate = true
    }
    // un compito col suo frameId, quindi con la sua passata d'ombra
    const esegui = () => {
      const conFotogramma = nuovoFotogramma(r)
      chiediOmbra()
      lista.shift()?.()
      return conFotogramma
    }
    const inizio = performance.now()
    const nate = pipelineNate(r)
    if (esegui()) {
      while (
        !mossa &&
        lista.length &&
        nate >= 0 &&
        pipelineNate(r) === nate &&
        performance.now() - inizio < BUDGET_MS
      ) {
        esegui()
      }
      // il render vero che segue ha un frameId suo: ridisegna l'ombra intera
      nuovoFotogramma(r)
      chiediOmbra()
    }
  }, -1)

  return null
}
