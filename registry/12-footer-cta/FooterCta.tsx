import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useSectionProgress } from '../../src/scroll/useSectionProgress'

gsap.registerPlugin(ScrollTrigger)

export interface FooterCopy {
  /** parola/e che scorrono nel marquee */
  marquee: string[]
  headline: string
  body: string
  ctaLabel: string
  ctaHref: string
  footnote: string
}

interface Props {
  id?: 'footer'
  copy: FooterCopy
  reduced: boolean
}

const MAGNET_STRENGTH = 0.4
const MAGNET_MAX = 18

// Blueprint 12 — congedo: marquee continuo, CTA magnetico, uscita.
//
// Il marquee è una sola tween infinita su una lista DUPLICATA, con `modifiers` che riporta la x
// dentro la metà: è il modo che non accumula errore né richiede di rimontare nulla a ogni ciclo.
// La copia duplicata è `aria-hidden`, altrimenti uno screen reader legge la frase due volte.
//
// Il CTA è un vero <a>: il magnetismo è una decorazione sopra un link che funziona comunque —
// con la tastiera, col tasto centrale, col menu contestuale. Su puntatore grossolano non si
// aggancia (inseguire un dito che non resta sullo schermo produce solo sobbalzi), e con
// reduced-motion sparisce del tutto insieme al marquee, che diventa una riga ferma.
export function FooterCta({ id = 'footer', copy, reduced }: Props) {
  const sectionRef = useRef<HTMLElement>(null)
  const marqueeRef = useRef<HTMLDivElement>(null)
  const ctaRef = useRef<HTMLAnchorElement>(null)
  useSectionProgress(id, sectionRef)

  useGSAP(
    () => {
      if (reduced) return
      const cleanups: (() => void)[] = []

      const marquee = marqueeRef.current
      if (marquee) {
        const half = () => marquee.scrollWidth / 2
        const loop = gsap.to(marquee, {
          x: () => -half(),
          duration: 18,
          ease: 'none',
          repeat: -1,
          modifiers: { x: (x) => `${gsap.utils.wrap(-half(), 0, parseFloat(x))}px` },
        })
        cleanups.push(() => {
          loop.kill()
          gsap.set(marquee, { x: 0 })
        })
      }

      const cta = ctaRef.current
      if (cta && window.matchMedia('(pointer: fine)').matches) {
        const toX = gsap.quickTo(cta, 'x', { duration: 0.45, ease: 'power3' })
        const toY = gsap.quickTo(cta, 'y', { duration: 0.45, ease: 'power3' })
        const onMove = (e: PointerEvent) => {
          const r = cta.getBoundingClientRect()
          toX(
            gsap.utils.clamp(
              -MAGNET_MAX,
              MAGNET_MAX,
              (e.clientX - (r.left + r.width / 2)) * MAGNET_STRENGTH,
            ),
          )
          toY(
            gsap.utils.clamp(
              -MAGNET_MAX,
              MAGNET_MAX,
              (e.clientY - (r.top + r.height / 2)) * MAGNET_STRENGTH,
            ),
          )
        }
        const rest = () => {
          toX(0)
          toY(0)
        }
        // l'ascolto è sulla SEZIONE, non sul bottone: un magnete che si attiva solo quando sei
        // già sopra il bersaglio non è un magnete, è un hover
        sectionRef.current?.addEventListener('pointermove', onMove)
        sectionRef.current?.addEventListener('pointerleave', rest)
        cta.addEventListener('blur', rest)
        cleanups.push(() => {
          sectionRef.current?.removeEventListener('pointermove', onMove)
          sectionRef.current?.removeEventListener('pointerleave', rest)
          cta.removeEventListener('blur', rest)
          gsap.set(cta, { x: 0, y: 0 })
        })
      }

      return () => {
        for (const c of cleanups) c()
      }
    },
    { scope: sectionRef, dependencies: [reduced, copy.marquee.join('')] },
  )

  const words = copy.marquee.join(' · ')

  return (
    <section id={id} ref={sectionRef} className="bp-footer" aria-labelledby={`${id}-title`}>
      <div className="bp-footer__marquee" aria-hidden={!reduced}>
        <div ref={marqueeRef} className="bp-footer__marquee-track">
          <span>{words}</span>
          <span aria-hidden="true">{words}</span>
        </div>
      </div>

      <div className="bp-footer__inner">
        <h2 id={`${id}-title`} className="bp-footer__title">
          {copy.headline}
        </h2>
        <p className="bp-footer__body">{copy.body}</p>
        <a ref={ctaRef} className="bp-cta bp-footer__cta" href={copy.ctaHref}>
          {copy.ctaLabel}
        </a>
        <p className="bp-footer__footnote">{copy.footnote}</p>
      </div>
    </section>
  )
}
