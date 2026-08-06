import { useCallback, useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin'
import { useSectionProgress } from '../../src/scroll/useSectionProgress'

gsap.registerPlugin(ScrollTrigger, ScrambleTextPlugin)

export interface CardItem {
  tag: string
  title: string
  /** faccia posteriore: il dettaglio che si scopre girando la scheda */
  detail: string
}

export interface CardCopy {
  eyebrow: string
  headline: string
  items: CardItem[]
}

interface Props {
  id?: 'card'
  copy: CardCopy
  reduced: boolean
}

const MAGNET_STRENGTH = 0.28
const MAGNET_MAX = 14

// Blueprint 09 — schede interattive: decodifica del titolo all'ingresso, magnetismo al puntatore,
// ribaltamento su click o tastiera.
//
// Tre scelte che rendono questo blueprint accessibile invece che solo vistoso:
//
// 1. La scheda è un <button>, non un div con onClick. Ottiene gratis fuoco, invio/spazio, ruolo
//    e ordine di tabulazione; `aria-expanded` dice a uno screen reader se è girata, e la faccia
//    nascosta è `aria-hidden` così il testo non viene letto due volte.
// 2. Il magnetismo vive su un `gsap.quickTo` per asse: crearlo una volta e riusarlo evita di
//    allocare una tween a ogni pointermove, che è il modo classico di far scattare una griglia.
//    Su puntatore grossolano (dito) il magnetismo NON si aggancia: inseguire un tocco che non
//    resta sullo schermo produce solo sobbalzi.
// 3. Con `prefers-reduced-motion` niente scramble e niente magnetismo — ma il ribaltamento resta,
//    perché è contenuto, non decorazione. Diventa istantaneo invece che sparire.
export function InteractionCard({ id = 'card', copy, reduced }: Props) {
  const sectionRef = useRef<HTMLElement>(null)
  const [flipped, setFlipped] = useState<string | null>(null)

  useSectionProgress(id, sectionRef)

  useGSAP(
    () => {
      const cards = gsap.utils.toArray<HTMLElement>('.bp-card', sectionRef.current)
      if (cards.length === 0) return
      if (reduced) return

      const cleanups: (() => void)[] = []

      // ingresso: il titolo si decodifica
      for (const card of cards) {
        const title = card.querySelector<HTMLElement>('.bp-card__title')
        if (!title) continue
        const finalText = title.textContent ?? ''
        const tween = gsap.to(title, {
          duration: 1.1,
          scrambleText: { text: finalText, chars: 'upperCase', speed: 0.4, revealDelay: 0.2 },
          ease: 'none',
          scrollTrigger: { trigger: card, start: 'top 85%', toggleActions: 'play none none none' },
        })
        cleanups.push(() => {
          tween.scrollTrigger?.kill()
          tween.kill()
          title.textContent = finalText // se si smonta a metà decodifica, non lasciare rumore
        })
      }

      // magnetismo: solo su puntatore fine
      if (window.matchMedia('(pointer: fine)').matches) {
        for (const card of cards) {
          const toX = gsap.quickTo(card, 'x', { duration: 0.5, ease: 'power3' })
          const toY = gsap.quickTo(card, 'y', { duration: 0.5, ease: 'power3' })
          const onMove = (e: PointerEvent) => {
            const r = card.getBoundingClientRect()
            const dx = e.clientX - (r.left + r.width / 2)
            const dy = e.clientY - (r.top + r.height / 2)
            toX(gsap.utils.clamp(-MAGNET_MAX, MAGNET_MAX, dx * MAGNET_STRENGTH))
            toY(gsap.utils.clamp(-MAGNET_MAX, MAGNET_MAX, dy * MAGNET_STRENGTH))
          }
          const onLeave = () => {
            toX(0)
            toY(0)
          }
          card.addEventListener('pointermove', onMove)
          card.addEventListener('pointerleave', onLeave)
          // il fuoco da tastiera non ha coordinate: riporta la scheda al centro, o resterebbe
          // spostata dall'ultimo passaggio del mouse mentre la stai navigando con il tab
          card.addEventListener('blur', onLeave)
          cleanups.push(() => {
            card.removeEventListener('pointermove', onMove)
            card.removeEventListener('pointerleave', onLeave)
            card.removeEventListener('blur', onLeave)
            gsap.set(card, { x: 0, y: 0 })
          })
        }
      }

      return () => {
        for (const c of cleanups) c()
      }
    },
    { scope: sectionRef, dependencies: [reduced, copy.items.length] },
  )

  const toggle = useCallback((tag: string) => {
    setFlipped((current) => (current === tag ? null : tag))
  }, [])

  return (
    <section id={id} ref={sectionRef} className="bp-cards" aria-labelledby={`${id}-title`}>
      <header className="bp-cards__head">
        <p className="bp-eyebrow">{copy.eyebrow}</p>
        <h2 id={`${id}-title`} className="bp-h2">
          {copy.headline}
        </h2>
      </header>

      <ul className="bp-cards__grid">
        {copy.items.map((item) => {
          const isFlipped = flipped === item.tag
          return (
            <li key={item.tag}>
              <button
                type="button"
                className={`bp-card${isFlipped ? ' is-flipped' : ''}${reduced ? ' bp-card--still' : ''}`}
                aria-expanded={isFlipped}
                onClick={() => toggle(item.tag)}
              >
                <span className="bp-card__face" aria-hidden={isFlipped}>
                  <span className="bp-card__tag">{item.tag}</span>
                  <span className="bp-card__title">{item.title}</span>
                </span>
                <span className="bp-card__face bp-card__face--back" aria-hidden={!isFlipped}>
                  <span className="bp-card__detail">{item.detail}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
