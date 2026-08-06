import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useSectionProgress } from '../../src/scroll/useSectionProgress'

gsap.registerPlugin(ScrollTrigger)

export interface GalleryItem {
  /** numero/etichetta corta in mono, sopra il titolo */
  tag: string
  title: string
  note: string
  /** opzionale: immagine reale. Senza, la figura resta un campo di token (demo del kit). */
  src?: string
  alt?: string
}

export interface GalleryCopy {
  eyebrow: string
  headline: string
  items: GalleryItem[]
}

interface Props {
  id?: 'gallery'
  copy: GalleryCopy
  reduced: boolean
}

// Blueprint 07 — griglia magazine: rivelazione all'ingresso + parallasse per colonna.
//
// La parallasse è per COLONNA, non per elemento: sfalsare ogni cella indipendentemente fa
// sciogliere la griglia e il lettore perde l'allineamento orizzontale che rende «magazine» una
// griglia. Le colonne si muovono a velocità diverse, le righe restano leggibili.
//
// Il numero di colonne lo decide il CSS (grid auto-fit), quindi la profondità di parallasse si
// legge dall'indice dell'elemento modulo il conteggio EFFETTIVO di colonne, misurato dal DOM: su
// mobile la griglia collassa a una colonna e la parallasse deve annullarsi da sé, senza una
// media query gemella in JS che prima o poi divergerà dal CSS.
export function EditorialGallery({ id = 'gallery', copy, reduced }: Props) {
  const sectionRef = useRef<HTMLElement>(null)
  const gridRef = useRef<HTMLUListElement>(null)
  useSectionProgress(id, sectionRef)

  useGSAP(
    () => {
      const grid = gridRef.current
      if (!grid) return
      const cells = gsap.utils.toArray<HTMLElement>('.bp-gallery__item', grid)
      if (cells.length === 0) return

      if (reduced) {
        gsap.set(cells, { autoAlpha: 1, y: 0 })
        return
      }

      // conteggio reale di colonne: quante celle condividono il primo offsetTop
      const firstTop = cells[0].offsetTop
      const columns = Math.max(1, cells.filter((c) => c.offsetTop === firstTop).length)

      const reveal = gsap.from(cells, {
        autoAlpha: 0,
        y: 48,
        duration: 0.8,
        stagger: { each: 0.06, from: 'start' },
        ease: 'power3.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 78%',
          toggleActions: 'play none none reverse',
        },
      })

      const drifts =
        columns > 1
          ? cells.map((cell, i) => {
              // colonne alterne salgono e scendono; l'ampiezza cresce verso il centro della riga
              const col = i % columns
              const dir = col % 2 === 0 ? -1 : 1
              return gsap.to(cell, {
                yPercent: dir * 6,
                ease: 'none',
                scrollTrigger: {
                  trigger: sectionRef.current,
                  start: 'top bottom',
                  end: 'bottom top',
                  scrub: true,
                },
              })
            })
          : []

      return () => {
        for (const t of [reveal, ...drifts]) {
          t.scrollTrigger?.kill()
          t.kill()
        }
      }
    },
    { scope: sectionRef, dependencies: [reduced, copy.items.length] },
  )

  return (
    <section id={id} ref={sectionRef} className="bp-gallery" aria-labelledby={`${id}-title`}>
      <header className="bp-gallery__head">
        <p className="bp-eyebrow">{copy.eyebrow}</p>
        <h2 id={`${id}-title`} className="bp-h2">
          {copy.headline}
        </h2>
      </header>

      <ul ref={gridRef} className="bp-gallery__grid">
        {copy.items.map((item) => (
          <li key={item.tag} className="bp-gallery__item">
            <figure className="bp-gallery__figure">
              {item.src ? (
                // decoding async + lazy: la griglia sta sotto la piega, non deve competere con
                // il canvas per la banda del primo paint
                <img src={item.src} alt={item.alt ?? ''} loading="lazy" decoding="async" />
              ) : (
                <span className="bp-gallery__placeholder" aria-hidden="true" />
              )}
              <figcaption>
                <span className="bp-gallery__tag">{item.tag}</span>
                <span className="bp-gallery__title">{item.title}</span>
                <span className="bp-gallery__note">{item.note}</span>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  )
}
