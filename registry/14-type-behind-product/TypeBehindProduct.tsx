import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { progressMap } from '../../src/scroll/progressMap'
import { useApproach } from '../../src/scroll/useSectionProgress'
import { largest, srcSet, type CutoutProduct } from '../../src/lib/cutouts'

gsap.registerPlugin(ScrollTrigger)

export interface VeilCopy {
  eyebrow: string
  /** la parola gigante che attraversa dietro il prodotto — 1-3 parole, va in maiuscolo */
  word: string
  headline: string
  caption?: string
}

interface Props {
  id?: 'veil'
  copy: VeilCopy
  product: CutoutProduct
  reduced: boolean
  pinVh?: number
  /** quanto attraversa la parola, in % della sua larghezza (100 = una campata piena) */
  travel?: number
  /** quante ripetizioni della parola nel nastro */
  repeat?: number
  sizes?: string
}

// Blueprint 14 — il display gigante scorre DIETRO il prodotto scontornato.
//
// È il movimento che fa sembrare caro un sito di prodotto, e non è un effetto: è un ordine di
// z-index. La parola sta sotto, lo scontornato sopra, e il fatto che il prodotto MANGI le
// lettere mentre passano è tutta la magia. Un titolo che scorre sopra la foto è un banner; lo
// stesso titolo che sparisce dietro l'oggetto e riappare dall'altra parte dice che l'oggetto sta
// nello spazio. Serve alpha vera — con una foto su fondo pieno l'effetto non esiste.
//
// Due proprietari distinti sul movimento orizzontale, mai lo stesso elemento:
//  · `.bp-veil__band`  → la corsa legata allo scroll (scrub)
//  · `.bp-veil__track` → l'inclinazione da VELOCITÀ, che rilassa a zero da sola
// Metterle sullo stesso nodo significa che l'ultima tween scritta cancella l'altra.
export function TypeBehindProduct({
  id = 'veil',
  copy,
  product,
  reduced,
  pinVh = 170,
  travel = 62,
  repeat = 3,
  sizes = '(max-width: 900px) 78vw, 42vw',
}: Props) {
  const sectionRef = useRef<HTMLElement>(null)
  const bandRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const productRef = useRef<HTMLDivElement>(null)
  const frontRef = useRef<HTMLDivElement>(null)

  useApproach(id, sectionRef)

  useGSAP(
    () => {
      const el = sectionRef.current
      const band = bandRef.current
      const track = trackRef.current
      const product = productRef.current
      const front = frontRef.current
      if (!el || !band || !track || !product || !front || reduced) return

      const mm = gsap.matchMedia()
      mm.add({ isMobile: '(max-width: 900px)', isDesktop: '(min-width: 901px)' }, (ctx) => {
        const { isMobile } = ctx.conditions as { isMobile: boolean }
        const run = isMobile ? travel * 0.55 : travel

        gsap.set(band, { xPercent: run / 2 })
        gsap.set(front, { autoAlpha: 0, y: 18 })

        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: el,
            start: 'top top',
            end: `+=${isMobile ? 130 : pinVh}%`,
            pin: true,
            scrub: true,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              progressMap[id] = self.progress
            },
            onToggle: (self) => el.classList.toggle('is-live', self.isActive),
          },
        })
        // la parola attraversa; il prodotto fa la CONTRO-parallasse (poco, e in senso opposto):
        // è lo scarto fra i due che dà profondità, non la corsa della parola da sola
        tl.to(band, { xPercent: -run / 2, duration: 1 }, 0)
        tl.fromTo(
          product,
          { xPercent: -run * 0.06, scale: 0.97 },
          { xPercent: run * 0.06, scale: 1.03, duration: 1 },
          0,
        )
        tl.to(front, { autoAlpha: 1, y: 0, duration: 0.22, ease: 'power2.out' }, 0.16)

        // Inclinazione da velocità: il nastro si piega quando si scrolla forte e torna dritto
        // da solo. `quickTo` scrive su un unico setter — nessuna coda di tween accavallate,
        // che è il modo classico di far tremare il testo.
        const skewTo = gsap.quickTo(track, 'skewX', { duration: 0.5, ease: 'power3.out' })
        const st = ScrollTrigger.create({
          trigger: el,
          start: 'top bottom',
          end: 'bottom top',
          onUpdate: (self) => {
            skewTo(gsap.utils.clamp(-9, 9, self.getVelocity() / -260))
          },
          onLeave: () => skewTo(0),
          onLeaveBack: () => skewTo(0),
        })

        return () => {
          st.kill()
          tl.scrollTrigger?.kill()
          tl.kill()
          progressMap[id] = 0
          el.classList.remove('is-live')
        }
      })

      return () => mm.revert()
    },
    { scope: sectionRef, dependencies: [reduced, pinVh, travel, id, product.id] },
  )

  const words = Array.from({ length: repeat }, (_, i) => i)
  const top = product.layers[product.layers.length - 1]

  return (
    <section
      id={id}
      ref={sectionRef}
      className={`bp-veil${reduced ? ' bp-veil--static' : ''}`}
      aria-labelledby={`${id}-title`}
    >
      <div className="bp-veil__stage" style={{ '--aspect': product.aspect } as React.CSSProperties}>
        {/* z0 — il nastro. Decorativo: il titolo vero è nel blocco in primo piano. */}
        <div className="bp-veil__band" ref={bandRef} aria-hidden="true">
          <div className="bp-veil__track" ref={trackRef}>
            {words.map((i) => (
              <span key={i} className="bp-veil__word">
                {copy.word}
              </span>
            ))}
          </div>
        </div>

        {/* z1 — lo scontornato, che mangia le lettere mentre passano */}
        <div className="bp-veil__product" ref={productRef}>
          {product.layers.map((layer) => (
            <picture key={layer.id}>
              <source type="image/avif" srcSet={srcSet(layer.sources.avif)} sizes={sizes} />
              <source type="image/webp" srcSet={srcSet(layer.sources.webp)} sizes={sizes} />
              <img
                className="bp-veil__layer"
                src={largest(layer.sources.webp)}
                alt=""
                aria-hidden="true"
                decoding="async"
                loading="lazy"
                fetchPriority={layer.id === top?.id ? 'high' : 'low'}
              />
            </picture>
          ))}
        </div>
      </div>

      {/* z2 — il contenuto accessibile: qui sta il titolo vero della sezione */}
      <div className="bp-veil__front" ref={frontRef}>
        <p className="bp-eyebrow">{copy.eyebrow}</p>
        <h2 id={`${id}-title`} className="bp-veil__headline">
          {copy.headline}
        </h2>
        {copy.caption && <p className="bp-veil__caption">{copy.caption}</p>}
      </div>
    </section>
  )
}
