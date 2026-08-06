import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useLenis } from 'lenis/react'
import gsap from 'gsap'
import {
  getCanvasMounted,
  getLoadProgress,
  getLoading,
  subscribeLoadProgress,
} from '../../src/lib/loadProgress'

interface Props {
  /** tempo minimo a schermo, evita il flash su cache calda */
  minShowMs?: number
  reduced?: boolean
  /**
   * La pagina monterà un canvas 3D? Se no (niente WebGL → poster), non c'è nessun chunk da
   * aspettare e il failsafe parte subito. Senza questo, una macchina senza WebGL — cioè proprio
   * quella già penalizzata — si prenderebbe il sipario per tutto il tetto assoluto.
   */
  expectsCanvas?: boolean
}

// Blueprint 01 — preloader con progresso REALE degli asset. Il valore NON arriva da drei: lo
// pubblica il chunk del canvas in src/lib/loadProgress.ts (leggi lì il perché — importare drei da
// qui rimetterebbe three nel grafo statico dell'entry). Blocca Lenis finché carica, poi sipario.
export function PreloaderProgress({
  minShowMs = 600,
  reduced = false,
  expectsCanvas = true,
}: Props) {
  const progress = useSyncExternalStore(subscribeLoadProgress, getLoadProgress, getLoadProgress)
  const canvasMounted = useSyncExternalStore(subscribeLoadProgress, getCanvasMounted, getCanvasMounted)
  const loading = useSyncExternalStore(subscribeLoadProgress, getLoading, getLoading)
  const lenis = useLenis()
  const rootRef = useRef<HTMLDivElement>(null)
  const shownAt = useRef(performance.now())
  const [ready, setReady] = useState(false)
  const [gone, setGone] = useState(false)

  // Quale delle due strade ha reso pronto il preloader. Il log le distingue di proposito: se il
  // ponte del progresso si rompe, il preloader continua a funzionare degradando al failsafe — un
  // peggioramento invisibile a occhio, che così compare in console e lo raccoglie `npm run qa:verify`.
  // `warn` solo per le strade anomale: «progress» e «coda ferma» sono i due esiti sani (cache
  // fredda e cache calda). Un warning che compare a ogni visita normale smette di essere letto,
  // e il giorno che il ponte del progresso si rompe nessuno se ne accorge.
  const readyVia = useRef<string | null>(null)
  const markReady = useRef((via: string, anomaly = false) => {
    if (readyVia.current) return
    readyVia.current = via
    const log = anomaly ? console.warn : console.info
    log(`[kit] preloader ready via: ${via}`)
    setReady(true)
  }).current

  // pronto quando i loader arrivano a 100 (grace anti-flicker)…
  useEffect(() => {
    if (progress >= 100) {
      const t = window.setTimeout(() => markReady('progress'), 150)
      return () => window.clearTimeout(t)
    }
  }, [progress, markReady])

  // …oppure quando la coda è ferma: il canvas c'è (o non è atteso) e non c'è nulla in volo. È il
  // caso della cache calda, dove il progresso NON parte mai e resta 0 per sempre. Gli 800 ms di
  // grazia servono a non alzare il sipario nell'istante fra il mount del canvas e la partenza
  // dell'HDRI. Se invece il canvas non è ancora sceso dalla rete, aspettarlo è giusto: scoprire
  // una scena vuota è un peggioramento travestito da salvataggio.
  useEffect(() => {
    if (expectsCanvas && !canvasMounted) return
    if (loading) return
    const t = window.setTimeout(() => markReady('coda ferma (nessun asset da caricare)'), 800)
    return () => window.clearTimeout(t)
  }, [expectsCanvas, canvasMounted, loading, markReady])

  // Tetto assoluto: qualunque cosa vada storta, il preloader non sequestra il sito.
  useEffect(() => {
    const t = window.setTimeout(() => markReady('tetto assoluto 10s', true), 10000)
    return () => window.clearTimeout(t)
  }, [markReady])

  // scroll bloccato finché il sipario è giù
  useEffect(() => {
    if (gone) return
    lenis?.stop()
    return () => lenis?.start()
  }, [lenis, gone])

  useEffect(() => {
    if (!ready || gone) return
    const wait = Math.max(0, minShowMs - (performance.now() - shownAt.current))
    const t = window.setTimeout(() => {
      const el = rootRef.current
      const done = () => {
        lenis?.start()
        setGone(true)
      }
      if (!el || reduced) {
        done()
        return
      }
      gsap.to(el, { yPercent: -100, duration: 0.8, ease: 'power3.inOut', onComplete: done })
    }, wait)
    return () => window.clearTimeout(t)
  }, [ready, gone, minShowMs, reduced, lenis])

  if (gone) return null
  return (
    <div ref={rootRef} className="bp-preloader" role="status" aria-live="polite">
      <p className="bp-eyebrow">loading assets</p>
      <p className="bp-preloader__counter" aria-hidden="true">
        {Math.round(progress)}
        <span>%</span>
      </p>
    </div>
  )
}
