// Target di scena scritti dal SOLO CameraDirector a ogni frame; i materiali (MorphingForm,
// GradientBackdrop) dampano i propri uniform verso questi valori. Due livelli, un solo
// scrittore per livello: director→targets, materiale→uniform (regola one-owner del kit).
export const sceneTargets = {
  morph: 0.15, // apertura del displacement della forma (0..1)
  gradientMix: 0, // presenza del backdrop gradient (0..1)
  camX: 0,
  camY: 0,
  camZ: 6,
}
