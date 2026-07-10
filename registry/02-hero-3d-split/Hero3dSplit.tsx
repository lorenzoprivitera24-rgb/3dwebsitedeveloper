import { useRef } from 'react'
import { motion } from 'motion/react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useSectionProgress } from '../../src/scroll/useSectionProgress'

gsap.registerPlugin(ScrollTrigger)

export interface HeroCopy {
  eyebrow: string
  headline: string
  sub: string
  cta?: { label: string; href: string }
}

interface Props {
  id?: 'hero'
  copy: HeroCopy
  reduced: boolean
}

// Blueprint 02 — hero editoriale sopra la scena persistente: copy a sinistra (desktop), la forma
// 3D vive nella metà destra tramite la posa camera del capitolo "hero" (CameraDirector).
// Grammatica: il testo ENTRA (one-shot, Motion); il fade-out in uscita è scrub (è scena).
export function Hero3dSplit({ id = 'hero', copy, reduced }: Props) {
  const sectionRef = useRef<HTMLElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  useSectionProgress(id, sectionRef)

  useGSAP(
    () => {
      if (reduced || !innerRef.current) return
      gsap.to(innerRef.current, {
        opacity: 0,
        y: -90,
        ease: 'none',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: '40% top',
          end: 'bottom top',
          scrub: true,
          invalidateOnRefresh: true,
        },
      })
    },
    { scope: sectionRef, dependencies: [reduced] },
  )

  const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]
  const enter = (delay: number) => ({
    initial: { opacity: 0, y: reduced ? 0 : 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8, ease: EASE, delay },
  })

  return (
    <section id={id} ref={sectionRef} className="bp-hero" aria-label={copy.headline}>
      <div className="bp-hero__sticky">
        <div ref={innerRef} className="bp-hero__copy">
          <motion.p className="bp-eyebrow" {...enter(0)}>
            {copy.eyebrow}
          </motion.p>
          <motion.h1 className="bp-hero__title" {...enter(0.06)}>
            {copy.headline}
          </motion.h1>
          <motion.p className="bp-hero__sub" {...enter(0.14)}>
            {copy.sub}
          </motion.p>
          {copy.cta && (
            <motion.a className="bp-cta" href={copy.cta.href} {...enter(0.22)}>
              {copy.cta.label}
            </motion.a>
          )}
        </div>
      </div>
    </section>
  )
}
