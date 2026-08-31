import { useRef } from 'react'
import { AdaptiveEvents, PerformanceMonitor } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { qaEnabled } from '../qa/bridge'

interface Props {
  /** dpr range del tier statico: [floor, ceiling]. Il tier decide il punto di partenza,
   *  questo layer si muove SOLO dentro quel range — mai sopra il ceiling del tier. */
  dpr: [number, number]
}

// Il layer ADATTIVO runtime (ROADMAP «Adaptive layer», chiuso ago 2026): useQualityTier sceglie
// il punto di partenza dai segnali disponibili al load; questo componente misura come va DAVVERO
// e muove il dpr dentro il range del tier. Divisione dei ruoli: tier = stima, qui = misura.
//
// Un solo owner (regola 2): il dpr runtime lo scrive SOLO questo componente, via setDpr dal
// factor smussato del PerformanceMonitor. Niente <AdaptiveDpr>: reagisce a performance.regress()
// e sarebbe un secondo scrittore dello stesso dpr. <AdaptiveEvents> invece tocca solo il
// raycast (events.enabled) durante la finestra di regress — proprietà diversa, owner diverso.
//
// flipflops=3 + onFallback: se la macchina oscilla (sale/scende 3 volte), ci si arrende al
// floor e si smette di ballare — un dpr che cambia di continuo è peggio di un dpr basso fisso
// (ogni cambio = resize dei buffer di render).
//
// Con ?qa=1 il layer NON monta: i gate (stato, pixel, scrub) esigono determinismo, e su
// SwiftShader il monitor degraderebbe subito il dpr facendo flakare i confronti pixel.
export function AdaptiveQuality({ dpr }: Props) {
  const setDpr = useThree((s) => s.setDpr)
  const performance = useThree((s) => s.performance)
  const [floor, ceiling] = dpr
  // l'ultimo dpr scritto, per scrivere solo su cambi reali (quantizzati a passi di 0.25:
  // ogni scrittura costa un resize dei buffer, non va fatta a ogni oscillazione del factor)
  const last = useRef(ceiling)

  if (qaEnabled()) return null

  const apply = (raw: number) => {
    const clamped = Math.min(ceiling, Math.max(floor, raw))
    const stepped = Math.round(clamped * 4) / 4
    if (stepped !== last.current) {
      last.current = stepped
      setDpr(stepped)
    }
  }

  return (
    <>
      <PerformanceMonitor
        // factor parte a 1 e scende/sale smussato con i frame misurati
        onChange={({ factor }) => apply(floor + (ceiling - floor) * factor)}
        onDecline={() => {
          // finestra di regress: AdaptiveEvents spegne il raycast finché non si risale
          performance.regress()
        }}
        flipflops={3}
        onFallback={() => apply(floor)}
      />
      <AdaptiveEvents />
    </>
  )
}
