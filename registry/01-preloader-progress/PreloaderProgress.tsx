import { useEffect, useRef, useState } from 'react'
import { useProgress } from '@react-three/drei'
import { useLenis } from 'lenis/react'
import gsap from 'gsap'

interface Props {
  /** tempo minimo a schermo, evita il flash su cache calda */
  minShowMs?: number
  reduced?: boolean
}

// Blueprint 01 — preloader con progresso REALE degli asset (drei useProgress aggancia il
// DefaultLoadingManager di three: HDRI, GLB, texture). Blocca Lenis finché carica, poi sipario.
export function PreloaderProgress({ minShowMs = 600, reduced = false }: Props) {
  const { progress } = useProgress()
  const lenis = useLenis()
  const rootRef = useRef<HTMLDivElement>(null)
  const shownAt = useRef(performance.now())
  const [ready, setReady] = useState(false)
  const [gone, setGone] = useState(false)

  // pronto quando i loader arrivano a 100 (grace anti-flicker di useProgress)…
  useEffect(() => {
    if (progress >= 100) {
      const t = window.setTimeout(() => setReady(true), 150)
      return () => window.clearTimeout(t)
    }
  }, [progress])
  // …o comunque dopo 4s (pagina senza asset tracciati: il preloader non deve MAI sequestrare il sito)
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 4000)
    return () => window.clearTimeout(t)
  }, [])

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
