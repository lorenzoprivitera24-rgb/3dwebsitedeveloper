import { useRef } from 'react'
import { motion } from 'motion/react'
import { useSectionProgress } from '../../src/scroll/useSectionProgress'

export interface GradientCopy {
  eyebrow: string
  headline: string
  sub: string
}

interface Props {
  id?: 'gradient'
  copy: GradientCopy
  reduced: boolean
}

// Blueprint 03 — mesh gradient TSL a tutto schermo: la parte DOM è un pannello editoriale
// sticky; il campo visivo è il GradientBackdrop DENTRO la scena persistente, che il
// CameraDirector accende/spegne leggendo progressMap.gradient (sin(π·p): entra ed esce).
// Il materiale e le sue uniform: src/canvas/materials/gradientField.ts (colori dai token).
export function MeshGradientField({ id = 'gradient', copy, reduced }: Props) {
  const sectionRef = useRef<HTMLElement>(null)
  useSectionProgress(id, sectionRef)

  const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]
  const enter = (delay: number) => ({
    initial: { opacity: 0, y: reduced ? 0 : 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.4 },
    transition: { duration: 0.8, ease: EASE, delay },
  })

  return (
    <section id={id} ref={sectionRef} className="bp-gradient" aria-label={copy.headline}>
      <div className="bp-gradient__sticky">
        <div className="bp-panel">
          <motion.p className="bp-eyebrow" {...enter(0)}>
            {copy.eyebrow}
          </motion.p>
          <motion.h2 className="bp-h2" {...enter(0.06)}>
            {copy.headline}
          </motion.h2>
          <motion.p className="bp-sub" {...enter(0.14)}>
            {copy.sub}
          </motion.p>
        </div>
      </div>
    </section>
  )
}
