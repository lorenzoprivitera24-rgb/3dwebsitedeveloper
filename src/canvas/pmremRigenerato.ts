// ─────────────────────────────────────────────────────────────────────────────
// pmremRigenerato.ts: un HDRI smaltito torna a illuminare la scena al prossimo uso.
//
// Il difetto è di three (r185.1, e uguale in r186.1 e sul ramo dev al 22 ott 2026), nel renderer a
// nodi su TUTTI e due i motori. three genera il PMREM di un HDRI una volta e lo lega alla texture
// d'origine: `_getPMREMFromTexture` (nodes/pmrem/PMREMNode.js) mette sulla texture un ascoltatore di
// `dispose` che smaltisce il PMREM e lo toglie dalla cache. Il `PMREMNode` che lo campiona (uno per
// renderer e per texture, tenuto in cache da EnvironmentNode.js) però non lo sa: tiene il riferimento,
// e il suo `updateBefore` rifà il PMREM solo se cambia `pmremVersion`, che una dispose non tocca. Da lì
// il materiale campiona una texture smaltita, che il backend ricrea vuota: l'IBL è nero finché la
// pagina vive. Il renderer classico non ha il difetto: `WebGLEnvironments.getPMREM` cerca il PMREM in
// cache a ogni uso, e se la dispose l'ha tolto lo rifà. Riproduzione minima, senza React né drei:
// docs/repro/pmrem-dispose.html (render, `dispose()`, render: sfera nera su WebGPU e su WebGL2 a nodi,
// accesa col WebGLRenderer classico e con la cura; misurata in WebKit e Chromium il 22 ott 2026).
//
// Chi smaltisce. drei 10.7.8, `<Environment files>`: `texture.dispose()` nel cleanup di un
// `useEffect`, mentre `useLoader` tiene in cache lo stesso oggetto e lo ridà al montaggio dopo.
//  - In produzione: un ambiente smontato e rimontato con lo stesso renderer (un HDRI che cambia e
//    torna, un ramo condizionale, un genitore con una `key`) resta nero. Deterministico.
//  - In sviluppo: lo StrictMode esegue quel cleanup una volta subito dopo il montaggio. Se R3F ha già
//    disegnato un fotogramma (il rAF arriva prima del compito in cui React scarica gli effetti), il
//    PMREM è già nato e muore con la texture: una corsa. Misurata il 22 ott 2026 sul laboratorio
//    `?lab=ibl` senza cura: WebKit a taglia iPhone (WebGL2) nero in 16 visite su 28, tutte e sole
//    quelle con l'HDRI smaltito dopo il primo PMREM; con la cura 0 su 24 (corsa riparata in 14).
//    Chromium (WebGPU) 0 su 8, perché lì il compito di React è sempre arrivato prima del rAF.
//    Era «l'IBL nero a caso su WebKit» del 21 ott: né il PMREM nato nero (riletto dalla GPU appena
//    generato è pieno), né la texture di ripiego di PMREMNode, né l'MSAA su HalfFloat (il fondale
//    senza luce resta acceso).
//
// La cura. Alla nascita di ogni PMREM, un ascoltatore di `dispose` sulla texture d'origine alza la
// sua `pmremVersion` (`needsPMREMUpdate`, API pubblica): al prossimo uso il PMREMNode vede la versione
// cambiata, trova la cache vuota e three lo rigenera (ricaricando l'HDRI sulla GPU), come fa da sé il
// renderer classico. In più la texture del PMREM nato prende la versione della sorgente, come in
// WebGLEnvironments: senza, dopo una rigenerazione il PMREMNode ripasserebbe dalla cache a ogni
// fotogramma. Costa un PMREM rifatto per ogni dispose seguita da un nuovo uso, cioè ciò che serve.
//
// Il gate è `npm run qa:ibl`: `?pmrem=nudo` spegne la cura, e il laboratorio
// `?lab=ibl&ordine=rimonta` (l'ambiente smontato e rimontato dopo il primo PMREM) DEVE uscire nero.
// Il giorno che non esce più nero, three ha corretto il difetto e questa cura si toglie.
// ─────────────────────────────────────────────────────────────────────────────
import { PMREMGenerator, type RenderTarget, type Texture } from 'three/webgpu'

/**
 * `accesa`: ogni PMREM nato da una texture si rigenera dopo la sua dispose. `spenta`: `?pmrem=nudo`.
 * `interni-mancanti`: three ha cambiato PMREMGenerator, niente cura (riverificare il difetto).
 */
export type StatoPmrem = 'accesa' | 'spenta' | 'interni-mancanti'

type Genera = (sorgente: Texture, bersaglio?: RenderTarget | null) => RenderTarget

interface GeneratoreInterno {
  fromEquirectangular?: Genera
  fromCubemap?: Genera
  /** La cura è già sul prototipo (un secondo Stage nella stessa pagina non la raddoppia). */
  __kitPmrem?: true
}

/** Le texture d'origine che hanno già il loro ascoltatore: uno per texture, per sempre. */
const seguite = new WeakSet<Texture>()

function segui(sorgente: Texture, nato: RenderTarget) {
  nato.texture.pmremVersion = sorgente.pmremVersion
  if (seguite.has(sorgente)) return
  seguite.add(sorgente)
  sorgente.addEventListener('dispose', () => {
    sorgente.needsPMREMUpdate = true
  })
}

/**
 * Accende la cura sul prototipo di PMREMGenerator (una volta per pagina). Da chiamare nella factory
 * `gl` di Stage, prima del primo render: il primo PMREM nasce dentro il primo render della scena.
 */
export function rigeneraPmrem(): StatoPmrem {
  if (new URLSearchParams(window.location.search).get('pmrem') === 'nudo') return 'spenta'
  const g = PMREMGenerator.prototype as unknown as GeneratoreInterno
  const { fromEquirectangular, fromCubemap } = g
  if (typeof fromEquirectangular !== 'function' || typeof fromCubemap !== 'function') return 'interni-mancanti'
  if (g.__kitPmrem) return 'accesa'
  g.__kitPmrem = true
  g.fromEquirectangular = function (this: unknown, sorgente, bersaglio) {
    const nato = fromEquirectangular.call(this, sorgente, bersaglio)
    segui(sorgente, nato)
    return nato
  }
  g.fromCubemap = function (this: unknown, sorgente, bersaglio) {
    const nato = fromCubemap.call(this, sorgente, bersaglio)
    segui(sorgente, nato)
    return nato
  }
  return 'accesa'
}
