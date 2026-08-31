import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { progressMap } from '../../src/scroll/progressMap'
import { useApproach } from '../../src/scroll/useSectionProgress'
import {
  inkCenterY,
  largest,
  srcSet,
  type CutoutLayer,
  type CutoutProduct,
} from '../../src/lib/cutouts'

gsap.registerPlugin(ScrollTrigger)

export interface ExplodeNote {
  label: string
  desc?: string
}

export interface ExplodeCopy {
  eyebrow: string
  title: string
  /** chiave = layer.id del manifesto. Assente ⇒ si usa layer.label generata dal nome file. */
  notes?: Record<string, ExplodeNote>
}

interface Props {
  id?: 'explode'
  copy: ExplodeCopy
  product: CutoutProduct
  reduced: boolean
  /** durata del pin in vh (mobile usa 200) */
  pinVh?: number
  /** separazione fra strati adiacenti, in % dell'altezza dello stage */
  spread?: number
  /** se true la pila si richiude prima di uscire dalla sezione (default) */
  reassemble?: boolean
  sizes?: string
}

// Blueprint 13 — LA sezione del genere «prodotto editoriale»: la pila di scontornati si apre
// allo scrub, ogni strato si porta dietro la sua annotazione, poi si richiude prima di uscire.
//
// Le tre cose che la fanno sembrare vera, e che nessuna delle tre è il movimento:
//  1. REGISTRAZIONE — gli strati condividono un solo box (lo garantisce encode-cutouts.mjs) e
//     stanno tutti `inset: 0`. Niente offset indovinati: se la pila è allineata da assemblata,
//     resta allineata da esplosa.
//  2. L'ANNOTAZIONE STA DENTRO LO STRATO — un unico transform muove immagine, ombra ed
//     etichetta. Animare l'etichetta con una sua tween è il modo garantito per vederla sfasare
//     di qualche frame durante lo scrub veloce.
//  3. L'OMBRA RACCONTA IL DISTACCO — sale/scende col segno dello spostamento: chi si alza ha
//     l'ombra più larga e più tenue, chi scende l'ha più stretta e più densa. Senza questo
//     gli strati sembrano adesivi che scivolano, non oggetti che si staccano.
//
// Reduced-motion: nessun pin, pila assemblata ferma, la legenda diventa il contenuto.
export function ProductExplode({
  id = 'explode',
  copy,
  product,
  reduced,
  pinVh = 300,
  spread = 11,
  reassemble = true,
  sizes = '(max-width: 900px) 76vw, 40vw',
}: Props) {
  const sectionRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const layerRefs = useRef<Array<HTMLDivElement | null>>([])
  const shadowRefs = useRef<Array<HTMLImageElement | null>>([])
  const noteRefs = useRef<Array<HTMLDivElement | null>>([])
  const leaderRefs = useRef<Array<HTMLSpanElement | null>>([])

  const layers = product.layers
  const noteOf = (layer: CutoutLayer): ExplodeNote =>
    copy.notes?.[layer.id] ?? { label: layer.label }

  // la scena 3D dietro dev'essere già quieta al PRIMO fotogramma del pin, non calmarsi durante
  useApproach(id, sectionRef)

  useGSAP(
    () => {
      const el = sectionRef.current
      const stage = stageRef.current
      if (!el || !stage || reduced) return

      const els = layerRefs.current.filter(Boolean) as HTMLDivElement[]
      const shadows = shadowRefs.current.filter(Boolean) as HTMLImageElement[]
      const notes = noteRefs.current.filter(Boolean) as HTMLDivElement[]
      const leaders = leaderRefs.current.filter(Boolean) as HTMLSpanElement[]
      const center = (els.length - 1) / 2

      const mm = gsap.matchMedia()
      mm.add({ isMobile: '(max-width: 900px)', isDesktop: '(min-width: 901px)' }, (ctx) => {
        const { isMobile } = ctx.conditions as { isMobile: boolean }
        // mobile: meno corsa, meno distacco — lo stage è più stretto e la pila esplosa
        // uscirebbe dal viewport
        const step = isMobile ? spread * 0.7 : spread
        const shrink = isMobile ? 0.86 : 0.78

        gsap.set(els, { yPercent: 0 })
        gsap.set(stage, { scale: 1 })
        // yPercent qui e non in CSS: il transform dell'annotazione ha UN solo proprietario,
        // se no GSAP e il foglio di stile si sovrascrivono a vicenda
        gsap.set(notes, { autoAlpha: 0, x: -14, yPercent: -50 })
        gsap.set(leaders, { scaleX: 0, transformOrigin: 'left center' })

        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: el,
            start: 'top top',
            end: `+=${isMobile ? 200 : pinVh}%`,
            pin: true,
            scrub: true,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              progressMap[id] = self.progress
            },
            // will-change solo mentre la sezione è viva: tenerlo sempre acceso su cinque
            // livelli grandi costa memoria di compositing per tutta la pagina
            onToggle: (self) => stage.classList.toggle('is-live', self.isActive),
          },
        })

        els.forEach((layerEl, i) => {
          const k = i - center // <0 sotto il centro, >0 sopra
          tl.to(layerEl, { yPercent: -k * step, duration: 0.55, ease: 'power2.out' }, 0)
          const shadow = shadows[i]
          if (shadow) {
            tl.to(
              shadow,
              {
                scale: 1 + 0.11 * k,
                opacity: gsap.utils.clamp(0.15, 0.7, 0.48 - 0.08 * k),
                duration: 0.55,
                ease: 'power2.out',
              },
              0,
            )
          }
        })
        tl.to(stage, { scale: shrink, duration: 0.55, ease: 'power2.out' }, 0)
        tl.to(leaders, { scaleX: 1, duration: 0.26, stagger: 0.045 }, 0.32)
        tl.to(notes, { autoAlpha: 1, x: 0, duration: 0.22, stagger: 0.045 }, 0.34)

        if (reassemble) {
          // la pila si richiude PRIMA di uscire: la sezione successiva riceve il prodotto
          // intero, non un'esplosione a metà che si sfila dallo schermo
          tl.to(notes, { autoAlpha: 0, x: -8, duration: 0.1 }, 0.8)
          tl.to(leaders, { scaleX: 0, duration: 0.1 }, 0.8)
          tl.to(els, { yPercent: 0, duration: 0.2, ease: 'power2.inOut' }, 0.82)
          tl.to(shadows, { scale: 1, opacity: 0.48, duration: 0.2, ease: 'power2.inOut' }, 0.82)
          tl.to(stage, { scale: 1, duration: 0.2, ease: 'power2.inOut' }, 0.82)
        }

        return () => {
          tl.scrollTrigger?.kill()
          tl.kill()
          progressMap[id] = 0
          stage.classList.remove('is-live')
        }
      })

      return () => mm.revert()
    },
    { scope: sectionRef, dependencies: [reduced, pinVh, spread, reassemble, id, product.id] },
  )

  return (
    <section
      id={id}
      ref={sectionRef}
      className={`bp-explode${reduced ? ' bp-explode--static' : ''}`}
      aria-labelledby={`${id}-title`}
    >
      <div className="bp-explode__inner">
        <header className="bp-explode__head">
          <p className="bp-eyebrow">{copy.eyebrow}</p>
          <h2 id={`${id}-title`} className="bp-explode__title">
            {copy.title}
          </h2>
        </header>

        <div
          ref={stageRef}
          className="bp-explode__stage"
          style={{ '--aspect': product.aspect } as React.CSSProperties}
        >
          {layers.map((layer, i) => (
            <div
              key={layer.id}
              className="bp-explode__layer"
              ref={(node) => {
                layerRefs.current[i] = node
              }}
            >
              {layer.shadow && (
                <img
                  ref={(node) => {
                    shadowRefs.current[i] = node
                  }}
                  className="bp-explode__shadow"
                  src={layer.shadow}
                  alt=""
                  aria-hidden="true"
                  decoding="async"
                  loading="lazy"
                  style={
                    {
                      '--ink-x': layer.ink.x,
                      '--ink-y': layer.ink.y,
                      '--ink-w': layer.ink.w,
                    } as React.CSSProperties
                  }
                />
              )}
              <picture>
                <source type="image/avif" srcSet={srcSet(layer.sources.avif)} sizes={sizes} />
                <source type="image/webp" srcSet={srcSet(layer.sources.webp)} sizes={sizes} />
                <img
                  className="bp-explode__art"
                  src={largest(layer.sources.webp)}
                  alt=""
                  aria-hidden="true"
                  decoding="async"
                  loading="lazy"
                />
              </picture>
              {/* l'annotazione VIVE nello strato: un transform solo, zero sfasamento.
                  Decorativa: il testo accessibile è la legenda qui sotto. */}
              <div
                aria-hidden="true"
                className="bp-explode__note"
                ref={(node) => {
                  noteRefs.current[i] = node
                }}
                style={{ '--ink-center': inkCenterY(layer) } as React.CSSProperties}
              >
                <span
                  className="bp-explode__leader"
                  ref={(node) => {
                    leaderRefs.current[i] = node
                  }}
                />
                <span className="bp-explode__label">{noteOf(layer).label}</span>
                {noteOf(layer).desc && (
                  <span className="bp-explode__desc">{noteOf(layer).desc}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* LA legenda è il contenuto vero: visibile su mobile e in reduced-motion, letta sempre
            dagli screen reader. Le annotazioni nello stage ne sono la copia decorativa. */}
        <ol className="bp-explode__legend">
          {[...layers].reverse().map((layer) => (
            <li key={layer.id} className="bp-explode__legend-item">
              <span className="bp-explode__label">{noteOf(layer).label}</span>
              {noteOf(layer).desc && <span className="bp-explode__desc">{noteOf(layer).desc}</span>}
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
