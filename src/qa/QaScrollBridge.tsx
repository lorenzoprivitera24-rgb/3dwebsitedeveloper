import { useEffect } from 'react'
import { useLenis } from 'lenis/react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { registerDomHalf } from './bridge'

// La metà "DOM" del ponte QA: vive dentro <SmoothScroll> (il <Canvas> è una reconciler root
// separata, il context di Lenis non lo attraversa — per questo il ponte è in due metà).
//
// `scrubToSection` NON calcola pixel a mano: interroga ScrollTrigger, che è l'unica cosa che
// sa dove comincia e finisce davvero una sezione — comprese quelle pinnate, il cui spazio di
// scroll non coincide con l'altezza dell'elemento. Il gate parla quindi in unità di
// storyboard («al 50% di scrub») invece che in pixel, che cambierebbero a ogni ritocco al copy.
export function QaScrollBridge() {
  const lenis = useLenis()

  useEffect(() => {
    const triggerFor = (id: string) => {
      const el = document.getElementById(id)
      if (!el) return null
      // un elemento può avere più trigger (progress + pin): prendiamo quello con la
      // corsa di scroll più lunga, che è quello che descrive l'attraversamento.
      const candidates = ScrollTrigger.getAll().filter(
        (t) => t.trigger === el || (t.trigger instanceof HTMLElement && el.contains(t.trigger)),
      )
      if (candidates.length === 0) return null
      return candidates.reduce((a, b) => (b.end - b.start > a.end - a.start ? b : a))
    }

    return registerDomHalf({
      sections: () =>
        Array.from(document.querySelectorAll('main section[id]')).map((el) => el.id),
      scrubToSection: (id, p) => {
        const st = triggerFor(id)
        const el = document.getElementById(id)
        if (!st && !el) return false
        const clamped = Math.min(Math.max(p, 0), 1)
        // Sezioni senza trigger (es. l'outro, che non scrive la progress map) restano
        // interrogabili: si scorre lungo la loro altezza. Le invarianti valgono comunque —
        // anzi, l'outro è proprio dove la scena deve essere quieta.
        const y = st
          ? st.start + clamped * (st.end - st.start)
          : el!.offsetTop + clamped * Math.max(0, el!.offsetHeight - window.innerHeight)
        // immediate: salta l'animazione di Lenis — al gate interessa lo stato di arrivo,
        // non il viaggio (che è quello che lo screenshot, semmai, dovrà giudicare).
        if (lenis) lenis.scrollTo(y, { immediate: true, force: true })
        else window.scrollTo(0, y)
        ScrollTrigger.update()
        return true
      },
    })
  }, [lenis])

  return null
}
