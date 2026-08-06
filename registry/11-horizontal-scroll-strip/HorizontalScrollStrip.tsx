import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { progressMap } from '../../src/scroll/progressMap'

gsap.registerPlugin(ScrollTrigger)

export interface StripPanel {
  tag: string
  title: string
}

export interface StripCopy {
  eyebrow: string
  headline: string
  panels: StripPanel[]
}

interface Props {
  id?: 'strip'
  copy: StripCopy
  reduced: boolean
}

// Blueprint 11 — striscia orizzontale pinnata: lo scorrimento verticale traduce la striscia in
// orizzontale. Come il 05, questa sezione crea il PROPRIO trigger con pin e NON usa
// useSectionProgress: sarebbero due trigger sullo stesso elemento con geometrie diverse, e il
// progresso scritto nella mappa non corrisponderebbe a quello del pin.
//
// La corsa verticale è calcolata dalla larghezza REALE eccedente (`scrollWidth - clientWidth`),
// non da un multiplo di `100vh` scelto a occhio: con un numero di pannelli diverso, o su un
// viewport più stretto, un multiplo fisso lascia la striscia a metà o pinna una sezione vuota.
// `invalidateOnRefresh` la ricalcola a ogni resize.
//
// Con reduced-motion niente pin e niente traduzione: la striscia diventa un contenitore a
// scorrimento orizzontale nativo, che resta utilizzabile con la tastiera e con lo swipe.
export function HorizontalScrollStrip({ id = 'strip', copy, reduced }: Props) {
  const sectionRef = useRef<HTMLElement>(null)
  const trackRef = useRef<HTMLUListElement>(null)

  useGSAP(
    () => {
      const section = sectionRef.current
      const track = trackRef.current
      if (!section || !track) return

      if (reduced) {
        progressMap[id] = 0
        return
      }

      const distance = () => Math.max(0, track.scrollWidth - track.clientWidth)

      const tween = gsap.to(track, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: () => `+=${distance()}`,
          pin: true,
          scrub: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            progressMap[id] = self.progress
          },
        },
      })

      return () => {
        tween.scrollTrigger?.kill()
        tween.kill()
        gsap.set(track, { x: 0 })
        progressMap[id] = 0
      }
    },
    { scope: sectionRef, dependencies: [reduced, copy.panels.length, id] },
  )

  return (
    <section
      id={id}
      ref={sectionRef}
      className={`bp-strip${reduced ? ' bp-strip--static' : ''}`}
      aria-labelledby={`${id}-title`}
    >
      <header className="bp-strip__head">
        <p className="bp-eyebrow">{copy.eyebrow}</p>
        <h2 id={`${id}-title`} className="bp-h2">
          {copy.headline}
        </h2>
      </header>

      <ul ref={trackRef} className="bp-strip__track" tabIndex={reduced ? 0 : -1}>
        {copy.panels.map((panel) => (
          <li key={panel.tag} className="bp-strip__panel">
            <span className="bp-strip__tag">{panel.tag}</span>
            <span className="bp-strip__title">{panel.title}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
