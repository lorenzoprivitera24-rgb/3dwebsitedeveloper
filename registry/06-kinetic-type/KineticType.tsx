import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { useSectionProgress } from '../../src/scroll/useSectionProgress'

gsap.registerPlugin(ScrollTrigger, SplitText)

export interface KineticCopy {
  eyebrow: string
  lines: string[]
}

interface Props {
  id?: 'kinetic'
  copy: KineticCopy
  reduced: boolean
}

// Blueprint 06 — tipografia cinetica col SplitText 2025: mask integrato (`mask: 'lines'`,
// niente wrapper overflow-hidden a mano) + autoSplit (ri-splitta a resize/caricamento font,
// l'animazione si ricostruisce dentro onSplit — MAI fuori). Grammatica: il testo ENTRA
// (toggle, reversibile), non si scrubba. La scena intanto si calma (capitolo 'kinetic').
export function KineticType({ id = 'kinetic', copy, reduced }: Props) {
  const sectionRef = useRef<HTMLElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  useSectionProgress(id, sectionRef)

  useGSAP(
    () => {
      const title = titleRef.current
      if (!title) return
      if (reduced) {
        gsap.set(title, { autoAlpha: 1 })
        return
      }
      const split = SplitText.create(title, {
        type: 'lines',
        mask: 'lines',
        autoSplit: true,
        onSplit(self) {
          gsap.set(title, { autoAlpha: 1 }) // anti-FOUC: visibile solo a split avvenuto
          return gsap.from(self.lines, {
            yPercent: 120,
            duration: 0.9,
            stagger: 0.08,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: sectionRef.current,
              start: 'top 72%',
              toggleActions: 'play none none reverse',
            },
          })
        },
      })
      return () => split.revert()
    },
    { scope: sectionRef, dependencies: [reduced] },
  )

  return (
    <section id={id} ref={sectionRef} className="bp-kinetic" aria-label={copy.lines.join(' ')}>
      <p className="bp-eyebrow">{copy.eyebrow}</p>
      <h2 ref={titleRef} className="bp-kinetic__title">
        {copy.lines.map((line, i) => (
          <span key={i} className="bp-kinetic__line">
            {line}
          </span>
        ))}
      </h2>
    </section>
  )
}
