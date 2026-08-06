import type { RefObject } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { approachMap, progressMap, type SectionKey } from './progressMap'

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

// Il gemello per le sezioni PINNATE: scrive approachMap[id] mentre la sezione sale nel viewport
// e chiude a 1 nell'istante in cui il pin comincia. Le sezioni pinnate lo affiancano al proprio
// trigger di pin — useSectionProgress non va bene, il suo range finisce quando la sezione esce.
export function useApproach(id: SectionKey, ref: RefObject<HTMLElement | null>) {
  useGSAP(
    () => {
      const el = ref.current
      if (!el) return
      const st = ScrollTrigger.create({
        trigger: el,
        start: 'top bottom',
        end: 'top top',
        scrub: true,
        onUpdate: (self) => {
          approachMap[id] = self.progress
        },
      })
      return () => {
        st.kill()
        approachMap[id] = 0
      }
    },
    { dependencies: [id] },
  )
}
