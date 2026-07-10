import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { progressMap } from '../../src/scroll/progressMap'

gsap.registerPlugin(ScrollTrigger)

export interface ScrubCopy {
  eyebrow: string
  steps: string[]
}

interface Props {
  id?: 'scrub'
  copy: ScrubCopy
  reduced: boolean
  /** durata del pin in vh su desktop (mobile usa 180) */
  pinVh?: number
}

// Blueprint 05 — LA sezione del genere: pinnata, la scena si trasforma al ritmo dello scrub.
// Crea il proprio trigger (pin) e scrive progressMap.scrub; il CameraDirector orbita la camera
// e apre il morph. I caption DOM si avvicendano a soglie di progress (classList, zero re-render).
// Reduced-motion: NIENTE pin — colonna statica con tutti gli step visibili.
export function PinnedSceneScrub({ id = 'scrub', copy, reduced, pinVh = 250 }: Props) {
  const sectionRef = useRef<HTMLElement>(null)
  const stepRefs = useRef<Array<HTMLParagraphElement | null>>([])
  const thresholds = [0, 0.4, 0.75]

  useGSAP(
    () => {
      const el = sectionRef.current
      if (!el || reduced) return

      const setActive = (p: number) => {
        let active = 0
        for (let i = 0; i < thresholds.length; i++) if (p >= thresholds[i]) active = i
        stepRefs.current.forEach((s, i) => s?.classList.toggle('is-active', i === active))
      }
      setActive(0)

      const mm = gsap.matchMedia()
      mm.add(
        { isMobile: '(max-width: 767px)', isDesktop: '(min-width: 768px)' },
        (ctx) => {
          const { isMobile } = ctx.conditions as { isMobile: boolean }
          const st = ScrollTrigger.create({
            trigger: el,
            start: 'top top',
            end: `+=${isMobile ? 180 : pinVh}%`,
            pin: true,
            scrub: true,
            invalidateOnRefresh: true,
            anticipatePin: 1,
            onUpdate: (self) => {
              progressMap[id] = self.progress
              setActive(self.progress)
            },
          })
          return () => {
            st.kill()
            progressMap[id] = 0
          }
        },
      )
      return () => mm.revert()
    },
    { scope: sectionRef, dependencies: [reduced, pinVh, id] },
  )

  return (
    <section
      id={id}
      ref={sectionRef}
      className={`bp-scrub${reduced ? ' bp-scrub--static' : ''}`}
      aria-label={copy.eyebrow}
    >
      <div className="bp-scrub__inner">
        <p className="bp-eyebrow">{copy.eyebrow}</p>
        <div className="bp-scrub__steps">
          {copy.steps.map((step, i) => (
            <p
              key={i}
              ref={(node) => {
                stepRefs.current[i] = node
              }}
              className={`bp-scrub__step${reduced || i === 0 ? ' is-active' : ''}`}
            >
              {step}
            </p>
          ))}
        </div>
      </div>
    </section>
  )
}
