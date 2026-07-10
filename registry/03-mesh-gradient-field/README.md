# 03 · mesh-gradient-field

Il campo gradiente-firma del genere, in due metà: questa sezione DOM (pannello sticky con copy)
scrive `progressMap.gradient`; il quad TSL (`src/canvas/GradientBackdrop.tsx` + materiale in
`src/canvas/materials/gradientField.ts`) vive nella scena persistente e il CameraDirector lo
accende con `sin(π·p)` — entra, satura dietro la forma, esce. Colori e flow SOLO dai token
(`direction.md`); il puntatore deforma il campo (damped). Reduced: crossfade lento, flow 0.

Uso: sezione `<MeshGradientField copy={gradientJson} reduced={reduced} />` + `<GradientBackdrop
reduced={reduced} flowScale={tier === 'low' ? 0.5 : 1} />` dentro `<Scene>`.
