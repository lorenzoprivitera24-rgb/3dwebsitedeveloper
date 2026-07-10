import { useRef } from 'react'
import { motion } from 'motion/react'
import { useSectionProgress } from '../../src/scroll/useSectionProgress'

export interface PointerCopy {
  eyebrow: string
  headline: string
  body: string
}

interface Props {
  id?: 'pointer'
  copy: PointerCopy
  reduced: boolean
}

// Blueprint 04 (lato DOM) — pannello editoriale sticky a sinistra; il protagonista è il
// RigSatellite sulla scena persistente, che legge progressMap.pointer (scritto qui via
// useSectionProgress) per esistere solo in questa sezione. Il rig non scrive la camera:
// la scena resta nella posa calma ereditata dal capitolo kinetic (testimone esplicito).
export function PointerRig3d({ id = 'pointer', copy, reduced }: Props) {
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
    <section id={id} ref={sectionRef} className="bp-pointer" aria-label={copy.headline}>
      <div className="bp-pointer__sticky">
        <div className="bp-panel">
          <motion.p className="bp-eyebrow" {...enter(0)}>
            {copy.eyebrow}
          </motion.p>
          <motion.h2 className="bp-h2" {...enter(0.06)}>
            {copy.headline}
          </motion.h2>
          <motion.p className="bp-sub" {...enter(0.14)}>
            {copy.body}
          </motion.p>
        </div>
      </div>
    </section>
  )
}
