import type { MutableRefObject } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

interface Props {
  progress: MutableRefObject<number>
  trigger: string // CSS selector of the tall scroll track
}

// Owns the scroll -> progress mapping. Writes into a ref so the canvas can read it in useFrame
// without re-rendering React every frame. useGSAP handles cleanup of the ScrollTrigger.
//
// [motion engineer] extension point: replace this single scrub with a richer timeline
// (pinned sections, multi-stop camera moves) if the brief needs choreography.
export function ScrollProgressDriver({ progress, trigger }: Props) {
  useGSAP(
    () => {
      const st = ScrollTrigger.create({
        trigger,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
        onUpdate: (self) => {
          progress.current = self.progress
        },
      })
      return () => st.kill()
    },
    { dependencies: [trigger] },
  )

  return null
}
