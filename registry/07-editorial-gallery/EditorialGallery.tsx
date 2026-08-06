import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useSectionProgress } from '../../src/scroll/useSectionProgress'
import { largest, srcSet, type CutoutLayer, type CutoutProduct } from '../../src/lib/cutouts'

gsap.registerPlugin(ScrollTrigger)

export interface GalleryItem {
  title: string
  desc?: string
  /** prezzo o dato secco: va in mono, tabular-nums, allineato a destra */
  meta?: string
  tag?: string
  href?: string
  /** se presente mostra SOLO questo strato del prodotto (id dal manifesto) */
  layerId?: string
}

export interface GalleryCopy {
  eyebrow: string
  title: string
  items: GalleryItem[]
}

interface Props {
  id?: 'gallery'
  copy: GalleryCopy
  product: CutoutProduct
  reduced: boolean
  /** ampiezza della parallasse per card, in % dell'altezza dell'immagine */
  parallax?: number
  sizes?: string
}

// Blueprint 07 — la griglia magazine del genere «prodotto editoriale»: card con scontornato,
// nome, riga di dato (prezzo), reveal a cascata e una parallasse per card.
//
// Due proprietari, DUE NODI: la card fa il reveal (`transform` via GSAP), l'immagine dentro fa
// la parallasse (`transform` via GSAP su un altro nodo). L'hover invece non tocca `transform`:
// usa le proprietà CSS indipendenti `scale:`/`translate:`, che si compongono col transform di
// GSAP invece di sovrascriverlo. È il modo per avere hover E parallasse senza litigare.
export function EditorialGallery({
  id = 'gallery',
  copy,
  product,
  reduced,
  parallax = 7,
  sizes = '(max-width: 700px) 84vw, (max-width: 1100px) 42vw, 28vw',
}: Props) {
  const sectionRef = useRef<HTMLElement>(null)
  const cardRefs = useRef<Array<HTMLLIElement | null>>([])
  const artRefs = useRef<Array<HTMLDivElement | null>>([])
  useSectionProgress(id, sectionRef)

  const layerOf = (item: GalleryItem): CutoutLayer[] =>
    item.layerId ? product.layers.filter((l) => l.id === item.layerId) : product.layers

  useGSAP(
    () => {
      const el = sectionRef.current
      if (!el || reduced) return
      const cards = cardRefs.current.filter(Boolean) as HTMLLIElement[]
      const arts = artRefs.current.filter(Boolean) as HTMLDivElement[]

      // reveal: ENTRA, non si scrubba (grammatica awwwards-motion-patterns)
      gsap.from(cards, {
        y: 44,
        autoAlpha: 0,
        duration: 0.7,
        stagger: 0.08,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 76%', toggleActions: 'play none none reverse' },
      })

      // parallasse: si scrubba, sfalsata per colonna così la griglia respira invece di
      // muoversi come un blocco unico
      const tweens = arts.map((art, i) =>
        gsap.fromTo(
          art,
          { yPercent: parallax * (i % 2 === 0 ? 1 : 0.55) },
          {
            yPercent: -parallax * (i % 2 === 0 ? 1 : 0.55),
            ease: 'none',
            scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true },
          },
        ),
      )

      return () => {
        tweens.forEach((t) => {
          t.scrollTrigger?.kill()
          t.kill()
        })
      }
    },
    { scope: sectionRef, dependencies: [reduced, parallax, id, copy.items.length] },
  )

  return (
    <section id={id} ref={sectionRef} className="bp-gallery" aria-labelledby={`${id}-title`}>
      <header className="bp-gallery__head">
        <p className="bp-eyebrow">{copy.eyebrow}</p>
        <h2 id={`${id}-title`} className="bp-gallery__title">
          {copy.title}
        </h2>
      </header>

      <ul className="bp-gallery__grid">
        {copy.items.map((item, i) => {
          const Inner = item.href ? 'a' : 'div'
          return (
            <li
              key={item.title}
              className="bp-gallery__card"
              ref={(node) => {
                cardRefs.current[i] = node
              }}
            >
              <Inner className="bp-gallery__inner" {...(item.href ? { href: item.href } : {})}>
                <div className="bp-gallery__frame">
                  <div
                    className="bp-gallery__art"
                    ref={(node) => {
                      artRefs.current[i] = node
                    }}
                    style={{ '--aspect': product.aspect } as React.CSSProperties}
                  >
                    {layerOf(item).map((layer) => (
                      <picture key={layer.id}>
                        <source
                          type="image/avif"
                          srcSet={srcSet(layer.sources.avif)}
                          sizes={sizes}
                        />
                        <source
                          type="image/webp"
                          srcSet={srcSet(layer.sources.webp)}
                          sizes={sizes}
                        />
                        <img
                          className="bp-gallery__layer"
                          src={largest(layer.sources.webp)}
                          alt=""
                          aria-hidden="true"
                          decoding="async"
                          loading="lazy"
                        />
                      </picture>
                    ))}
                  </div>
                  {item.tag && <span className="bp-gallery__tag">{item.tag}</span>}
                </div>
                <div className="bp-gallery__row">
                  <h3 className="bp-gallery__name">{item.title}</h3>
                  {item.meta && <span className="bp-gallery__meta">{item.meta}</span>}
                </div>
                {item.desc && <p className="bp-gallery__desc">{item.desc}</p>}
              </Inner>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
