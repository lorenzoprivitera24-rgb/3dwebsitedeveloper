import { useEffect, type ReactNode } from 'react'
import { ReactLenis, useLenis } from 'lenis/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

// Bridges Lenis and GSAP into a SINGLE requestAnimationFrame loop.
// Lenis runs with autoRaf:false; gsap.ticker drives lenis.raf, and ScrollTrigger updates
// off Lenis scroll. There must be no other RAF touching scroll-linked state.
function GsapLenisSync() {
  const lenis = useLenis()

  useEffect(() => {
    if (!lenis) return

    const onScroll = () => ScrollTrigger.update()
    lenis.on('scroll', onScroll)

    const raf = (time: number) => lenis.raf(time * 1000) // gsap time is seconds, lenis wants ms
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)

    return () => {
      lenis.off('scroll', onScroll)
      gsap.ticker.remove(raf)
    }
  }, [lenis])

  return null
}

export function SmoothScroll({ children }: { children: ReactNode }) {
  return (
    <ReactLenis
      root
      options={{
        autoRaf: false, // gsap.ticker is the single RAF source
        lerp: 0.1,
        smoothWheel: true,
        // smoothTouch is intentionally left off: it can feel laggy on long pages.
      }}
    >
      <GsapLenisSync />
      {children}
    </ReactLenis>
  )
}
