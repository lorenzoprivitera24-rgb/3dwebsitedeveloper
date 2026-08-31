import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useSectionProgress } from '../../src/scroll/useSectionProgress'

gsap.registerPlugin(ScrollTrigger)

export interface StatementCopy {
  eyebrow: string
  /** una riga per elemento: ogni riga entra col suo reveal */
  lines: string[]
  credit?: string
  /** foto di sfondo opzionale; senza, un placeholder generato (nessun asset richiesto) */
  image?: { src: string; alt: string }
}

interface Props {
  id?: 'statement'
  copy: StatementCopy
  reduced: boolean
}

// Blueprint 10 — la dichiarazione: display gigante sopra una foto, eyebrow mono.
// È punteggiatura editoriale: UNA frase, campo lungo, poi si riparte.
//
// Due movimenti, due nature (stessa grammatica del 07):
// - il reveal delle righe ENTRA e basta (toggle: una dichiarazione non si scrubba — o è detta
//   o non lo è); ogni riga sale da dietro una maschera overflow:hidden.
// - la foto sotto DERIVA scrubbata (fromTo lento): il testo fermo sopra un fondo che scorre è
//   ciò che dà il senso di lastra incisa, non stampata.
// L'hover non esiste: niente da toccare qui. reduced = tutto fermo e già visibile.
export function DisplayStatement({ id = 'statement', copy, reduced }: Props) {
  const sectionRef = useRef<HTMLElement>(null)

  useSectionProgress(id, sectionRef)

  useGSAP(
    () => {
      if (reduced || !sectionRef.current) return
      gsap.from(gsap.utils.toArray<HTMLElement>('.bp-statement__line-inner', sectionRef.current), {
        yPercent: 110,
        duration: 0.9,
        ease: 'power3.out',
        stagger: 0.12,
        scrollTrigger: { trigger: sectionRef.current, start: 'top 68%' },
      })
      gsap.fromTo(
        '.bp-statement__media',
        { yPercent: -8 },
        {
          yPercent: 8,
          ease: 'none',
          scrollTrigger: { trigger: sectionRef.current, start: 'top bottom', end: 'bottom top', scrub: true },
        },
      )
    },
    { dependencies: [reduced], scope: sectionRef },
  )

  return (
    <section id={id} className="bp-statement" ref={sectionRef}>
      <figure className="bp-statement__media" aria-hidden={copy.image ? undefined : true}>
        {copy.image ? (
          <img src={copy.image.src} alt={copy.image.alt} loading="lazy" />
        ) : (
          <div className="bp-statement__placeholder" />
        )}
      </figure>
      <div className="bp-statement__inner">
        <p className="bp-statement__eyebrow">{copy.eyebrow}</p>
        <h2 className="bp-statement__display">
          {copy.lines.map((line) => (
            <span className="bp-statement__line" key={line}>
              <span className="bp-statement__line-inner">{line}</span>
            </span>
          ))}
        </h2>
        {copy.credit && <p className="bp-statement__credit">{copy.credit}</p>}
      </div>
    </section>
  )
}
