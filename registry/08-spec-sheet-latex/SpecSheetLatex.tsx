import { useEffect, useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useSectionProgress } from '../../src/scroll/useSectionProgress'

gsap.registerPlugin(ScrollTrigger)

export interface SpecRow {
  label: string
  value: string
  /** LaTeX sorgente (senza $): se presente, la cella si arricchisce con KaTeX al mount. */
  formula?: string
  /** indice 1-based nella lista footnotes */
  footnote?: number
}

export interface SpecCopy {
  eyebrow: string
  headline: string
  rows: SpecRow[]
  footnotes: string[]
}

interface Props {
  id?: 'spec'
  copy: SpecCopy
  reduced: boolean
}

// Blueprint 08 — scheda tecnica con formule e note a piè di sezione.
//
// KaTeX è un ARRICCHIMENTO, non una dipendenza del primo paint: entra da import dinamico dentro
// useEffect (js + css nello stesso chunk lazy, font woff2 self-host emessi da Vite — GDPR ok,
// regola 9 salva: l'entry non lo preannuncia). Finché non arriva — o se fallisce — la cella
// mostra la sorgente LaTeX in <code>: la scheda è leggibile SEMPRE, la formula bella è un upgrade.
// L'output KaTeX porta con sé .katex-mathml per gli screen reader.
//
// Le note sono note vere: <sup><a>→ e ↩ di ritorno, entrambe àncore con id — la tastiera
// viaggia avanti e indietro senza perdere il punto.
export function SpecSheetLatex({ id = 'spec', copy, reduced }: Props) {
  const sectionRef = useRef<HTMLElement>(null)
  const [katexReady, setKatexReady] = useState(false)

  useSectionProgress(id, sectionRef)

  useEffect(() => {
    let alive = true
    Promise.all([import('katex'), import('katex/dist/katex.min.css')])
      .then(([k]) => {
        if (!alive || !sectionRef.current) return
        const cells = sectionRef.current.querySelectorAll<HTMLElement>('.bp-spec__formula-render')
        for (const cell of cells) {
          k.default.render(cell.dataset.formula ?? '', cell, { throwOnError: false })
        }
        setKatexReady(true)
      })
      .catch(() => {
        /* niente KaTeX = resta la sorgente in <code>, per scelta */
      })
    return () => {
      alive = false
    }
  }, [copy])

  useGSAP(
    () => {
      if (reduced || !sectionRef.current) return
      // reveal a cascata delle righe: ENTRA e basta (toggle), mai scrubbato — è contenuto tecnico,
      // deve arrivare leggibile, non ballare col dito sul trackpad
      gsap.from(gsap.utils.toArray<HTMLElement>('.bp-spec__row', sectionRef.current), {
        opacity: 0,
        y: 18,
        duration: 0.55,
        ease: 'power2.out',
        stagger: 0.06,
        scrollTrigger: { trigger: sectionRef.current, start: 'top 72%' },
      })
    },
    { dependencies: [reduced], scope: sectionRef },
  )

  return (
    <section id={id} className="bp-spec" ref={sectionRef}>
      <div className="bp-spec__inner">
        <header className="bp-spec__head">
          <p className="bp-spec__eyebrow">{copy.eyebrow}</p>
          <h2 className="bp-spec__title">{copy.headline}</h2>
        </header>
        <dl className="bp-spec__table">
          {copy.rows.map((row) => (
            <div className="bp-spec__row" key={row.label}>
              <dt className="bp-spec__label">{row.label}</dt>
              <dd className="bp-spec__value">
                {row.value}
                {row.formula && (
                  <span className="bp-spec__formula">
                    {/* due nodi FRATELLI: KaTeX scrive solo nel -render (che per React non ha
                        figli, quindi non li riconcilia mai); il <code> fallback è di React e
                        React lo toglie da solo quando katexReady scatta. Mai lo stesso nodo. */}
                    {!katexReady && <code>{row.formula}</code>}
                    <span className="bp-spec__formula-render" data-formula={row.formula} />
                  </span>
                )}
                {row.footnote && (
                  <sup>
                    <a
                      id={`fnref-${row.footnote}`}
                      href={`#fn-${row.footnote}`}
                      aria-label={`nota ${row.footnote}`}
                    >
                      {row.footnote}
                    </a>
                  </sup>
                )}
              </dd>
            </div>
          ))}
        </dl>
        <ol className="bp-spec__footnotes">
          {copy.footnotes.map((note, i) => (
            <li key={i} id={`fn-${i + 1}`}>
              {note}{' '}
              <a href={`#fnref-${i + 1}`} aria-label="torna al riferimento">
                ↩
              </a>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
