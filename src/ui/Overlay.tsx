import { motion, useScroll, useTransform } from 'motion/react'

interface Props {
  reduced: boolean
}

// DOM overlay. Uses Motion (motion/react) only; it never touches Three objects.
// It reads native scroll via Motion's useScroll, which stays consistent with Lenis
// (Lenis wraps native scroll). The 3D layer reads the ref; this layer reads useScroll.
//
// [ui engineer] extension point: this is a skeleton. Build the real sections, navigation,
// and CTA here, with the full responsive + accessibility pass.
export function Overlay({ reduced }: Props) {
  const { scrollYProgress } = useScroll()

  // when reduced motion is requested, flatten the parallax ranges to zero
  const titleY = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [0, -160])
  const subY = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [0, -80])
  const fade = useTransform(scrollYProgress, [0, 0.35], [1, reduced ? 1 : 0])

  return (
    <div className="hero">
      <motion.div className="hero__inner" style={{ opacity: fade }}>
        <motion.p
          className="hero__eyebrow"
          initial={{ opacity: 0, y: reduced ? 0 : 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          WebGPU / TSL / R3F v9
        </motion.p>

        <motion.h1
          className="hero__title"
          style={{ y: titleY }}
          initial={{ opacity: 0, y: reduced ? 0 : 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
        >
          Form in Motion
        </motion.h1>

        <motion.p
          className="hero__sub"
          style={{ y: subY }}
          initial={{ opacity: 0, y: reduced ? 0 : 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.12 }}
        >
          Scroll, or move your cursor across the shape. On a phone, drag your finger.
        </motion.p>

        <motion.a
          className="hero__cta"
          href="#built-to-extend"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          Keep scrolling
        </motion.a>
      </motion.div>
    </div>
  )
}
