import type { RefObject } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { progressMap, type SectionKey } from './progressMap'

gsap.registerPlugin(ScrollTrigger)

// Un trigger per sezione che scrive progressMap[id] (0→1 nell'attraversamento della viewport).
// I blueprint NON pilotano la scena direttamente: scrivono il progress, il CameraDirector decide.
// Le sezioni pinnate (05) creano il proprio trigger con pin e NON usano questo hook.
export function useSectionProgress(
  id: SectionKey,
  ref: RefObject<HTMLElement | null>,
  opts: { start?: string; end?: string } = {},
) {
  useGSAP(
    () => {
      const el = ref.current
      if (!el) return
      const st = ScrollTrigger.create({
        trigger: el,
        start: opts.start ?? 'top bottom',
        end: opts.end ?? 'bottom top',
        scrub: true,
        onUpdate: (self) => {
          progressMap[id] = self.progress
        },
      })
      return () => {
        st.kill()
        progressMap[id] = 0
      }
    },
    { dependencies: [id, opts.start, opts.end] },
  )
}
