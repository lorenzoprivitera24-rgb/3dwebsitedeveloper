import { useEffect, useRef, useState } from 'react'
import { Environment } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { EquirectangularReflectionMapping, PMREMGenerator, PMREMNode, RenderTarget, Texture } from 'three/webgpu'
import { Stage } from '../canvas/Stage'

// Il laboratorio dell'IBL (?lab=ibl), letto da `npm run qa:ibl`. Una sfera a specchio (metalness 1,
// roughness 0.15) riempie il quadro e riflette solo l'HDRI del kit, niente luci analitiche: un PMREM
// vuoto la spegne. Dietro, un fondale senza luce (MeshBasic) è il testimone della tela: se è nero
// anche lui, a non disegnare è il fotogramma intero (l'MSAA su HalfFloat di ANGLE Metal, per
// esempio), non l'ambiente.
//
// Riproduce il difetto di src/canvas/pmremRigenerato.ts: un HDRI smaltito lascia il suo PMREM
// smaltito sotto il PMREMNode, che non lo rifà più. Senza parametri è la pagina del kit: in dev lo
// StrictMode smaltisce l'HDRI (il cleanup di drei) subito dopo il montaggio, e se R3F ha già disegnato
// un fotogramma il PMREM muore con lui (una corsa: in WebKit ~una visita su due).
//   `&ordine=rimonta`  smonta l'ambiente qualche fotogramma dopo il primo PMREM e lo rimonta: la via di
//                      produzione, deterministica;
//   `&pmrem=nudo`      spegne la cura in Stage: con `ordine=rimonta` la sfera DEVE uscire nera.
// Un'altra via al nero, diversa, la apre `&compilazione=tutta` (i render del PMREM saltati dalla
// compilazione in parallelo): la guarda `qa:parallela` dalla console.
//
// La cronaca in console (`[kit] ibl: <evento> a <ms> ms`) dice chi genera e chi smaltisce il PMREM, e
// quando; ogni PMREM nato viene riletto dalla GPU (media e massimo: nato pieno o nato nero?), e
// `window.__iblLab.stato()` dice che cosa campiona ogni PMREMNode a fine visita.

const parametri = new URLSearchParams(window.location.search)
const ordine = parametri.get('ordine')

const cronaca = (evento: string) => console.info(`[kit] ibl: ${evento} a ${Math.round(performance.now())} ms`)
/** Quante volte three ha generato il PMREM dell'HDRI in questa pagina. */
let pmremGenerati = 0
/** Le texture dei PMREM nati, quelle smaltite, e i nodi che le campionano (per `stato()`). */
const nate = new WeakSet<object>()
const smaltite = new WeakSet<object>()
const nodi = new Set<object>()

/** Un half float (IEEE 754 binary16) in numero. */
function mezzo(h: number): number {
  const e = (h >> 10) & 0x1f
  const f = h & 0x3ff
  const v = e === 0 ? f / 1024 / 16384 : e === 31 ? Infinity : Math.pow(2, e - 15) * (1 + f / 1024)
  return h & 0x8000 ? -v : v
}

interface Leggibile {
  readRenderTargetPixelsAsync: (rt: RenderTarget, x: number, y: number, w: number, h: number) => Promise<ArrayLike<number>>
}

/** Rilegge dalla GPU il PMREM appena nato: media e massimo dei canali colore. */
async function rileggi(renderer: Leggibile, rt: RenderTarget, n: number) {
  try {
    const dati = await renderer.readRenderTargetPixelsAsync(rt, 0, 0, rt.width, rt.height)
    const half = dati instanceof Uint16Array
    let somma = 0
    let max = 0
    let conti = 0
    for (let i = 0; i < dati.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        const v = half ? mezzo(dati[i + c]) : dati[i + c]
        somma += v
        if (v > max) max = v
        conti++
      }
    }
    cronaca(`pmrem riletto (${n}): media ${(somma / conti).toFixed(3)}, massimo ${max.toFixed(1)}`)
  } catch (e) {
    cronaca(`pmrem riletto (${n}): errore ${(e as Error).message}`)
  }
}

// Le sonde, installate al caricamento del modulo (prima del primo render) e una volta sola.
const sonde = PMREMGenerator.prototype as unknown as { __iblLab?: boolean; fromEquirectangular: (...a: unknown[]) => unknown }
if (!sonde.__iblLab) {
  sonde.__iblLab = true
  const genera = sonde.fromEquirectangular
  sonde.fromEquirectangular = function (this: { _renderer: Leggibile }, ...a: unknown[]) {
    const rt = genera.apply(this, a) as RenderTarget
    const n = ++pmremGenerati
    nate.add(rt.texture)
    cronaca(`pmrem generato (${n})`)
    // la rilettura parte a render finito (il PMREM nasce DENTRO il render della scena), ma prima di
    // ogni altro compito: un'eventuale dispose arriva dopo, in un compito suo
    const renderer = this._renderer
    queueMicrotask(() => void rileggi(renderer, rt, n))
    return rt
  }
  const smaltisciBersaglio = RenderTarget.prototype.dispose
  RenderTarget.prototype.dispose = function (this: RenderTarget) {
    if (this.texture?.name === 'PMREM.cubeUv') {
      smaltite.add(this.texture)
      cronaca('pmrem smaltito')
    }
    return smaltisciBersaglio.call(this)
  }
  // updateFromTexture non è nei tipi di three: è il punto in cui un PMREMNode prende il suo PMREM
  const nodo = PMREMNode.prototype as unknown as { updateFromTexture: (t: Texture) => void }
  const aggiorna = nodo.updateFromTexture
  nodo.updateFromTexture = function (this: object, texture: Texture) {
    nodi.add(this)
    return aggiorna.call(this, texture)
  }
  const smaltisciTexture = Texture.prototype.dispose
  Texture.prototype.dispose = function (this: Texture) {
    if (this.mapping === EquirectangularReflectionMapping) cronaca('hdri smaltito')
    return smaltisciTexture.call(this)
  }
}

/** Che cosa campiona ogni PMREMNode adesso: letto dal gate a fine visita. */
;(window as unknown as { __iblLab: unknown }).__iblLab = {
  stato: () => ({
    generati: pmremGenerati,
    nodi: [...nodi].map((nodo) => {
      const v = (nodo as unknown as { _texture: { value: object } })._texture.value
      return nate.has(v) ? (smaltite.has(v) ? 'pmrem smaltito' : 'pmrem vivo') : 'texture di ripiego'
    }),
  }),
}

function Sfera() {
  // il gate riconosce il laboratorio da questa riga: senza, misurerebbe un'altra pagina
  useEffect(() => console.info(`[kit] laboratorio ibl: ordine=${ordine ?? 'naturale'}`), [])
  const primo = useRef(false)
  useFrame(() => {
    if (primo.current) return
    primo.current = true
    cronaca('primo fotogramma')
  })
  return (
    <>
      <mesh>
        <sphereGeometry args={[1.6, 96, 64]} />
        <meshStandardNodeMaterial color="#ffffff" metalness={1} roughness={0.15} />
      </mesh>
      {/* il testimone della tela: senza luce, quindi acceso anche con l'IBL vuoto */}
      <mesh position={[0, 0, -3]}>
        <planeGeometry args={[10, 10]} />
        <meshBasicNodeMaterial color="#808080" />
      </mesh>
    </>
  )
}

/** `&ordine=rimonta`: smonta l'ambiente qualche fotogramma dopo il primo PMREM, poi lo rimonta. */
function useRimonta(): boolean {
  const [montato, setMontato] = useState(true)
  const fase = useRef<{ passo: 'attesa' | 'smontato' | 'fatto'; fotogrammi: number }>({ passo: 'attesa', fotogrammi: 0 })
  useFrame(() => {
    if (ordine !== 'rimonta') return
    const f = fase.current
    f.fotogrammi++
    if (f.passo === 'attesa' && pmremGenerati > 0 && f.fotogrammi > 10) {
      f.passo = 'smontato'
      f.fotogrammi = 0
      cronaca('ambiente smontato')
      setMontato(false)
    } else if (f.passo === 'smontato' && f.fotogrammi > 10) {
      f.passo = 'fatto'
      cronaca('ambiente rimontato')
      setMontato(true)
    }
  })
  return montato
}

function Ambiente() {
  const montato = useRimonta()
  // lo stesso HDRI self-host della demo (Scene.tsx): mai <Environment preset>, è una CDN terza
  return montato ? <Environment files="/hdri/studio_small_08_1k.hdr" /> : null
}

export default function IblLab() {
  return (
    <div className="canvas-layer" aria-hidden="true" style={{ position: 'fixed', inset: 0 }}>
      <Stage dpr={[1, 1]} cameraPosition={[0, 0, 5]}>
        <Ambiente />
        <Sfera />
      </Stage>
    </div>
  )
}
