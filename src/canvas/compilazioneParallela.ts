// ─────────────────────────────────────────────────────────────────────────────
// compilazioneParallela.ts: su WebGL2 i programmi della scena si compilano senza fermare la pagina.
//
// Il dato che l'ha deciso (SILKET, 24 set 2026, `?diagnostica` da un iPhone con iOS 18.7, motore
// WebGL2 perché su iOS 18 WebGPU non c'è): dopo il riscaldamento la scena girava a 57-60 fps con
// 3-5 ms di JavaScript per fotogramma, quindi la GPU del telefono reggeva. Tutto il resto era
// compilazione: 157 programmi che in totale tenevano ferma la pagina per ~30 s, un compito di
// riscaldamento da 2,5 s, il primo fotogramma 3D a 7,9 s. Sul Mac gli stessi 157 costano un quarto
// di secondo: su iOS la traduzione GLSL → Metal è cento volte più cara.
//
// Il blocco non è la compilazione, è la DOMANDA. three chiede `getProgramParameter(LINK_STATUS)`
// subito dopo `linkProgram` (`WebGLBackend._completeCompile`), e quella chiamata aspetta che il
// processo GPU abbia finito. Con `KHR_parallel_shader_compile` si chiede invece «hai finito?»
// (`COMPLETION_STATUS_KHR`), che risponde subito: three sa già farlo, ma solo dentro
// `compileAsync()`, perché il render normale passa `promises = null` a `Pipelines.getForRender`.
// Qui il render normale passa un elenco (che nessuno aspetta): il programma nasce in parallelo, e
// finché non è pronto `Pipelines.isReady` è falso e `Renderer._renderObjectDirect` SALTA l'oggetto
// invece di bloccare. L'oggetto arriva un attimo dopo; la pagina non si ferma.
//
// Portato da SILKET (src/canvas/compilazioneParallela.ts, 24 set 2026) il 21 ott 2026, con due
// differenze. La prima è un tetto ai link in volo anche nel render vero (`IN_VOLO_MAX`, misurato
// sotto): SILKET ce l'ha solo nel riscaldamento, ma in WebKit ogni domanda al processo GPU fa la coda
// dietro i link già lanciati, e senza tetto il primo fotogramma ne lancia tanti quanti gli oggetti in
// quadro. La seconda non poteva emergere lì: **in parallelo vanno solo gli oggetti della scena
// presentata** (quella di R3F, registrata da Stage) quando non ha un `overrideMaterial`. SILKET
// non ha un ambiente; il kit sì (`<Environment files>`), e three ne genera il PMREM con render
// suoi (materiali `PMREM_*`) UNA volta per versione della texture: un render che salta i suoi
// oggetti lascerebbe l'IBL nero per sempre. Stessa sorte per ogni risultato che non si ridisegna a
// ogni fotogramma: la conversione equirettangolare → cubo (`CubeRenderTarget`), un ambiente coi
// Lightformer (`CubeCamera`), le ombre su richiesta (`shadow.autoUpdate = false`, che passano da
// `scene.overrideMaterial`). Quelli restano sincroni: pochi programmi, pagati una volta. Fuori
// dalla scena restano sincroni anche i quad di post (pochi, e un quad saltato non si vedrebbe nel
// conto della rivelazione). Il negativo è `?compilazione=tutta`, il comportamento di SILKET alla
// lettera: deve spegnere l'IBL, e `npm run qa:parallela` controlla che lo faccia.
//
// La cura dei VAO (indiciWebGL.ts) è indispensabile con questa: un oggetto saltato ha già caricato
// i suoi indici, e senza la cura toglie gli indici al VAO dell'oggetto disegnato prima.
//
// Solo su WebGL2 e solo se l'estensione c'è: senza, three resta sul percorso sincrono. Su WebGPU la
// creazione della pipeline non blocca JavaScript. `?sincrono` spegne la cura per l'A/B sullo stesso
// pacchetto. Su tutti i percorsi resta il conto del fotogramma, che serve alla rivelazione.
//
// La rivelazione. Con la compilazione in parallelo i primi fotogrammi disegnerebbero la scena a
// pezzi mentre i programmi arrivano: la tela nasce trasparente (Stage) e si mostra al primo
// fotogramma COMPLETO, cioè uno che ha disegnato almeno un oggetto della scena presentata senza
// saltarne nessuno. Su WebGPU e in `?sincrono` niente viene saltato: è il primo fotogramma che
// disegna la scena. Il paracadute a `PARACADUTE_MS` la mostra comunque: un programma che non
// compila mai non deve lasciare il sito senza scena.
// ─────────────────────────────────────────────────────────────────────────────

interface PipelinesInterne {
  getForRender: (renderObject: unknown, promises?: unknown[] | null) => unknown
  updateForRender: (renderObject: unknown) => void
  isReady: (renderObject: unknown) => boolean
  /** `DataMap.get`: i dati dell'oggetto, con la sua pipeline se è già nata. */
  get: (renderObject: unknown) => { pipeline?: unknown }
}

interface RendererInterno {
  backend?: { isWebGPUBackend?: boolean; parallel?: unknown }
  _pipelines?: PipelinesInterne
}

/** Ciò che serve di un `RenderObject` di three r185: la scena del render che lo disegna. */
interface OggettoDiRender {
  scene?: { overrideMaterial?: unknown } | null
  material?: { name?: string } | null
}

/**
 * `accesa`: WebGL2 con `KHR_parallel_shader_compile`. `spenta`: `?sincrono`. `senza-estensione`:
 * WebGL2 senza l'estensione, three compila in modo sincrono da sé. `webgpu`: non serve.
 * `interni-mancanti`: three ha cambiato `Pipelines`, niente cura e niente conto (e la tela non si
 * nasconde, perché nessuno saprebbe quando mostrarla).
 */
export type StatoCompilazione = 'accesa' | 'spenta' | 'senza-estensione' | 'webgpu' | 'interni-mancanti'

/** Oltre questo la tela si mostra anche se il fotogramma non è mai stato completo. */
export const PARACADUTE_MS = 10000

/**
 * Al più tanti link in volo nel render vero (`?involo=N` per l'A/B, anche dal telefono). In WebKit
 * ogni domanda al processo GPU, anche il «hai finito?» di `COMPLETION_STATUS_KHR`, fa la coda dietro
 * i link in volo: ~25 ms con 1, ~40 con 2, ~125 con 4, ~300 con 8, oltre un secondo senza tetto (e
 * il `LINK_STATUS` sincrono del quad di uscita, dietro 48 link, ~1,7 s). `npm run qa:parallela`,
 * 21 ott 2026, laboratorio di carico (49 programmi, cache fredda, WebKit a taglia iPhone 15),
 * mediane di 3 giri per tetto:
 *   tetto      pagina ferma più a lungo   tempo bloccato   scena intera a
 *   sincrona   5,19 s                     5,14 s           5,20 s
 *   1          168 ms                     118 ms           6,66 s
 *   2          174 ms                     153 ms           3,77 s
 *   4          174 ms                     1,81 s           3,08 s
 *   8          302 ms                     2,33 s           3,04 s
 *   nessuno    1,77 s                     2,84 s           3,02 s
 * Con 2 la pagina non si ferma quasi mai e la scena arriva comunque prima che in modo sincrono.
 * Il telefono ha altri core e un altro processo GPU: il numero va riverificato lì con `?involo=N`.
 */
const IN_VOLO_MAX = 2

/** Stato di modulo: dopo un rimontaggio deve descrivere il renderer vivo (lo azzera la factory). */
export const rivelazione = { attesa: false, dal: 0 }

const conto = {
  /** La scena presentata (R3F): solo i suoi oggetti vanno in parallelo e contano. */
  scena: null as object | null,
  /** Render fuori conto in corso (il riscaldamento): compilano in parallelo ma non contano. */
  sospeso: 0,
  disegnati: 0,
  saltati: 0,
}

/** `?compilazione=tutta`: in parallelo anche i render che non si ripetono (il negativo). */
let tutta = false
/** I materiali saltati fuori dalla scena, già detti: uno per nome, al più `AVVISI_MAX`. */
const avvisati = new Set<string>()
const AVVISI_MAX = 12

/** L'oggetto sta in un render della scena presentata, senza materiale imposto (le ombre). */
function dellaScena(renderObject: unknown): boolean {
  const scena = (renderObject as OggettoDiRender).scene
  return scena != null && scena === conto.scena && !scena.overrideMaterial
}

/**
 * Accende la compilazione in parallelo, se il motore la permette, e su ogni percorso il conto del
 * fotogramma. Da chiamare nella factory `gl`, dopo `init()`.
 */
export function accendiCompilazioneParallela(renderer: unknown): StatoCompilazione {
  const r = renderer as RendererInterno
  const pipelines = r._pipelines
  conto.disegnati = 0
  conto.saltati = 0
  conto.sospeso = 0
  tutta = false
  avvisati.clear()
  if (
    !r.backend ||
    !pipelines ||
    typeof pipelines.getForRender !== 'function' ||
    typeof pipelines.updateForRender !== 'function' ||
    typeof pipelines.isReady !== 'function' ||
    typeof pipelines.get !== 'function'
  ) {
    return 'interni-mancanti'
  }
  // Il conto, su tutti i percorsi: un oggetto della scena presentata è pronto (si disegna) o no.
  const pronto = pipelines.isReady.bind(pipelines)
  pipelines.isReady = (renderObject: unknown) => {
    const ok = pronto(renderObject)
    if (dellaScena(renderObject)) {
      if (conto.sospeso === 0) {
        if (ok) conto.disegnati++
        else conto.saltati++
      }
    } else if (!ok && avvisati.size < AVVISI_MAX) {
      // Fuori dalla scena si compila in modo sincrono, quindi qui non si salta mai: se succede,
      // un PMREM o un'ombra su richiesta resteranno incompleti. Lo legge qa:parallela, che col
      // negativo `?compilazione=tutta` DEVE vederlo nominare un materiale `PMREM_*`.
      const nome = (renderObject as OggettoDiRender).material?.name || 'senza nome'
      if (!avvisati.has(nome)) {
        avvisati.add(nome)
        console.warn(`[kit] compilazione: saltato un oggetto fuori dalla scena presentata (materiale «${nome}»): un risultato che non si ridisegna resterà incompleto`)
      }
    }
    return ok
  }
  if (r.backend.isWebGPUBackend) return 'webgpu'
  const parametri = new URLSearchParams(window.location.search)
  if (parametri.has('sincrono')) return 'spenta'
  if (!r.backend.parallel) return 'senza-estensione'
  tutta = parametri.get('compilazione') === 'tutta'
  const tetto = Number(parametri.get('involo')) > 0 ? Number(parametri.get('involo')) : IN_VOLO_MAX
  // L'elenco in cui three mette una promessa per ogni link lanciato in parallelo: non la aspetta
  // nessuno, si risolve da sola (three interroga lo stato a ogni fotogramma). Qui serve solo a
  // contare i link ancora in volo.
  let inVoloN = 0
  const inVolo = {
    push(promessa: Promise<unknown>) {
      inVoloN++
      void promessa.then(() => {
        inVoloN--
      })
      return inVoloN
    },
  } as unknown as unknown[]
  pipelines.updateForRender = function (this: PipelinesInterne, renderObject: unknown) {
    const parallela = tutta || dellaScena(renderObject)
    // Il tetto: un oggetto senza pipeline ne farebbe nascere una, cioè un link. Con `tetto` link in
    // volo aspetta il suo turno, saltato come se il suo programma fosse già in volo. I render del
    // riscaldamento non aspettano: un compito consumato senza link lascerebbe il programma da
    // compilare sotto il dito, e Riscaldamento ha già il suo tetto (un programma nuovo per fotogramma).
    if (parallela && conto.sospeso === 0 && inVoloN >= tetto && this.get(renderObject).pipeline === undefined) return
    this.getForRender(renderObject, parallela ? inVolo : null)
  }
  return 'accesa'
}

/** La scena che R3F presenta: la registra Stage prima del primo fotogramma, `null` allo smontaggio. */
export function presentaScena(scena: object | null): void {
  conto.scena = scena
}

/**
 * Esegue `disegna` fuori dal conto della rivelazione: i suoi oggetti compilano in parallelo come
 * tutti quelli della scena, ma un render che non arriva a schermo (il riscaldamento, nel bersaglio
 * gemello) non deve dire se il fotogramma presentato è completo.
 */
export function fuoriConto(disegna: () => void): void {
  conto.sospeso++
  try {
    disegna()
  } finally {
    conto.sospeso--
  }
}

/** Il conto dalla lettura precedente (oggetti della scena disegnati e saltati), poi lo azzera. */
export function leggiFotogramma(): { disegnati: number; saltati: number } {
  const letto = { disegnati: conto.disegnati, saltati: conto.saltati }
  conto.disegnati = 0
  conto.saltati = 0
  return letto
}
