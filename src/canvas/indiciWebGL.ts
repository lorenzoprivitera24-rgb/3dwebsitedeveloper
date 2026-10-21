// ─────────────────────────────────────────────────────────────────────────────
// indiciWebGL.ts: su WebGL2 un buffer degli indici nuovo non tocca il VAO di un altro oggetto.
//
// Il difetto è di three (r185, `WebGLAttributeUtils._createBuffer` e `updateAttribute`): per
// caricare un buffer lo lega, ci scrive i dati e lega `null`. Con ELEMENT_ARRAY_BUFFER il legame
// fa parte del VAO legato IN QUEL MOMENTO: se è quello dell'oggetto disegnato prima, quel VAO
// perde i suoi indici. Il tracciatore di stato di three (`WebGLState.setVertexState`) crede di
// averli ancora, e al disegno seguente con lo stesso VAO salta il rilegame: `drawElements` senza
// indici, INVALID_OPERATION, e l'oggetto manca da quel fotogramma.
//
// Quando colpisce. Di solito l'oggetto che carica la geometria viene disegnato subito dopo: il
// suo VAO diventa quello legato, il cambio seguente rilega anche gli indici e il danno si ripara
// da sé (e `finishRender` slega tutto a fine render). Colpisce quando, DENTRO un render, un
// oggetto carica i suoi indici e poi NON viene disegnato, e il disegno successivo usa lo stesso
// VAO di quello precedente (mesh che condividono la geometria). Nel sorgente di r185 i casi sono
// due (`Renderer._renderObjectDirect`, `WebGLBackend.draw`):
//  - il programma è ancora in volo (`Pipelines.isReady` falso): succede con la compilazione in
//    parallelo nel render normale, la cura iOS di SILKET (`compilazioneParallela.ts`, 24 set 2026).
//    SILKET, 21 ott 2026, WebKit a iPhone 15 sul sito in rete, scroll partito durante il
//    caricamento: 3 giri su 3 con sfarfallii, 0 su 7 con questa cura;
//  - zero istanze (`InstancedMesh.count = 0`, un pool non ancora riempito, un
//    `InstancedBufferGeometry.instanceCount = 0`): `RenderObject.getDrawParameters` dà null e
//    `backend.draw` esce DOPO che la geometria è stata caricata. Questo il kit lo può fare anche
//    senza compilazione in parallelo.
//
// La cura: prima di creare o aggiornare un buffer degli indici si slega il VAO
// (`resetVertexState`, che azzera anche il tracciatore). Il caricamento tocca il VAO nullo, e il
// disegno seguente rilega VAO e indici per forza. Costa un `bindVertexArray(null)` per ogni
// caricamento di indici, cioè quasi niente. Su WebGPU non serve: lì gli indici si passano a ogni
// disegno (`setIndexBuffer`), non vivono in uno stato.
//
// Il gate è `npm run qa:indici` (WebKit a taglia iPhone, motore WebGL2): conta i disegni senza
// indici e gli INVALID_OPERATION del browser. `?indici=nudi` spegne la cura (il controllo
// negativo), e il laboratorio `?lab=indici` riproduce il difetto a comando.
// ─────────────────────────────────────────────────────────────────────────────

interface BackendInterno {
  isWebGPUBackend?: boolean
  gl?: WebGL2RenderingContext
  state?: { resetVertexState?: () => void }
  get?: (chiave: unknown) => { bufferType?: number }
  attributeUtils?: {
    createAttribute?: (attributo: unknown, tipo: number) => void
    updateAttribute?: (attributo: unknown) => void
  }
}

/**
 * `accesa`: la cura è sul backend WebGL2. `spenta`: `?indici=nudi`, solo per il controllo
 * negativo. `webgpu`: non serve. `interni-mancanti`: three ha cambiato gli interni che la cura
 * avvolge, e va riverificato se il difetto c'è ancora (il gate lo tratta come un errore).
 */
export type StatoIndici = 'accesa' | 'spenta' | 'webgpu' | 'interni-mancanti'

/** Accende la protezione sul backend WebGL2 di un WebGPURenderer già inizializzato. */
export function proteggiIndici(renderer: unknown): StatoIndici {
  const be = (renderer as { backend?: BackendInterno }).backend
  if (!be) return 'interni-mancanti'
  if (be.isWebGPUBackend) return 'webgpu'
  if (new URLSearchParams(window.location.search).get('indici') === 'nudi') return 'spenta'
  const { gl, state, attributeUtils } = be
  const crea = attributeUtils?.createAttribute
  const aggiorna = attributeUtils?.updateAttribute
  const slega = state?.resetVertexState
  if (!gl || !state || !slega || !be.get || !attributeUtils || !crea || !aggiorna) return 'interni-mancanti'
  const dati = be.get.bind(be)
  attributeUtils.createAttribute = (attributo, tipo) => {
    if (tipo === gl.ELEMENT_ARRAY_BUFFER) slega.call(state)
    crea.call(attributeUtils, attributo, tipo)
  }
  attributeUtils.updateAttribute = (attributo) => {
    const a = attributo as { isInterleavedBufferAttribute?: boolean; data?: unknown }
    if (dati(a.isInterleavedBufferAttribute ? a.data : a).bufferType === gl.ELEMENT_ARRAY_BUFFER) {
      slega.call(state)
    }
    aggiorna.call(attributeUtils, attributo)
  }
  return 'accesa'
}
