import { useControls, button, folder } from 'leva'
import look from '../../looks/03-gradient.json'
import { getGradientLook } from './materials/lookRegistry'

// Pannello di accordatura del blueprint 03 — SOLO in dev (CanvasLayer lo carica dietro
// `import.meta.env.DEV`, che in produzione è staticamente false: il ramo muore e leva non entra
// nel bundle, stessa tecnica del DevPerf).
//
// Ogni manopola scrive direttamente sulla uniform TSL: la scena cambia mentre trascini, senza
// reload e senza ricompilare lo shader. «Copia preset» rimette il risultato in JSON, da incollare
// in looks/03-gradient.json — è quello il passo che rende permanente l'accordatura.

type Knob = { key: Exclude<keyof typeof look, 'section'>; label: string; min: number; max: number; step: number }

const KNOBS: Knob[] = [
  { key: 'noiseScale', label: 'scala campo', min: 0.5, max: 12, step: 0.1 },
  { key: 'pointerInfluence', label: 'traino puntatore', min: 0, max: 2, step: 0.01 },
  { key: 'detailScale', label: 'scala vene', min: 0.5, max: 8, step: 0.1 },
  { key: 'detailOffset', label: 'sfasamento vene', min: 0, max: 20, step: 0.5 },
  { key: 'baseSpread', label: 'ampiezza fondo', min: 0, max: 1.5, step: 0.01 },
  { key: 'baseBias', label: 'MEDIA fondo (notte↔giorno)', min: 0, max: 1, step: 0.01 },
  { key: 'veinSpread', label: 'ampiezza vene', min: 0, max: 1.5, step: 0.01 },
  { key: 'veinBias', label: 'MEDIA vene', min: 0, max: 1, step: 0.01 },
]

export default function GradientLookPanel() {
  const [, set] = useControls(() => ({
    '03 · gradient field': folder(
      {
        ...Object.fromEntries(
          KNOBS.map(({ key, label, min, max, step }) => [
            key,
            {
              label,
              value: look[key],
              min,
              max,
              step,
              onChange: (v: number) => {
                const uniforms = getGradientLook()
                if (uniforms) uniforms[key].value = v
              },
            },
          ]),
        ),
        // Le uniform SONO ciò che la GPU sta usando: leggerle da lì invece che dallo stato di Leva
        // evita sia la chiusura stantia dei bottoni sia il rischio di copiare un valore diverso da
        // quello che stai guardando.
        'copia preset': button(() => {
          const uniforms = getGradientLook()
          const preset: Record<string, unknown> = { section: look.section }
          for (const { key } of KNOBS) {
            preset[key] = Number((uniforms ? uniforms[key].value : look[key]).toFixed(4))
          }
          const json = JSON.stringify(preset, null, 2)
          void navigator.clipboard?.writeText(json)
          console.info(`[kit] preset copiato — incollalo in looks/03-gradient.json\n${json}`)
        }),
        ripristina: button(() => {
          const uniforms = getGradientLook()
          const defaults: Record<string, number> = {}
          for (const { key } of KNOBS) {
            defaults[key] = look[key]
            if (uniforms) uniforms[key].value = look[key]
          }
          set(defaults)
        }),
      },
      { collapsed: false },
    ),
  }))

  return null
}
