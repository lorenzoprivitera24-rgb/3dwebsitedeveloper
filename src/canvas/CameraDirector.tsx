import { useFrame } from '@react-three/fiber'
import { MathUtils } from 'three'
import { progressMap } from '../scroll/progressMap'
import { sceneTargets } from './sceneState'

interface Props {
  reduced: boolean
}

// L'UNICA regia della scena persistente (skill scroll-scene-choreography): consuma la
// progress map, calcola i target dei canali (morph, gradientMix, camera) e possiede la camera.
// Le tratte si passano il testimone: lo stato B di una sezione È lo stato A della successiva
// (le lerp successive dominano perché le sezioni sono sequenziali: quando k>0, s è già 1).
export function CameraDirector({ reduced }: Props) {
  useFrame((state, delta) => {
    const cam = state.camera

    if (reduced) {
      // stato calmo: camera fissa, forma quieta; il gradient fa solo un crossfade lento di sezione
      sceneTargets.morph = 0.12
      sceneTargets.gradientMix = progressMap.gradient > 0.05 && progressMap.gradient < 0.95 ? 0.5 : 0
      cam.position.set(0, 0, 5.6)
      cam.lookAt(0, 0, 0)
      return
    }

    const h = progressMap.hero
    const g = progressMap.gradient
    const s = progressMap.scrub
    // la calmata del kinetic si COMPLETA al ~45% della sezione: il testo entra quasi subito
    // (trigger a top 72%) e deve trovare la scena già quieta — non calmarsi mentre esce
    // (finding QA giro 1: drammaturgia rovesciata + contrasto debole)
    const k = MathUtils.clamp(progressMap.kinetic * 2.2, 0, 1)

    // morph: 0.15 → 0.35 (hero) → 1.0 (scrub) → 0.15 (kinetic calma la scena)
    let morph = 0.15 + 0.2 * h
    morph = MathUtils.lerp(morph, 1.0, s)
    morph = MathUtils.lerp(morph, 0.15, k)
    sceneTargets.morph = morph

    // il backdrop entra ed esce dentro la sezione gradient, spento del tutto dal kinetic
    sceneTargets.gradientMix = Math.sin(Math.PI * MathUtils.clamp(g, 0, 1)) * (1 - k)

    // camera: avvicinamento (hero) → deriva (gradient) → orbita (scrub) → arretra (kinetic)
    // Nel capitolo kinetic il TESTO è il protagonista: su viewport stretti (aspect < 1,
    // mobile portrait) la ritirata cresce, o la forma continua a dominare il framing (QA giro 2).
    const aspect = 'aspect' in cam && typeof cam.aspect === 'number' ? cam.aspect : 1
    const kineticZ = 6.5 + (aspect < 1 ? (1 - aspect) * 4 : 0)
    let camZ = 6 - 1.5 * h
    camZ = MathUtils.lerp(camZ, 3.2, s)
    camZ = MathUtils.lerp(camZ, kineticZ, k)
    const camX = 0.3 * g + Math.sin(s * Math.PI * 0.9) * 1.2 * (1 - k)
    const camY = 0.4 * h + Math.sin(s * Math.PI) * 0.8 - 0.2 * k

    sceneTargets.camX = camX
    sceneTargets.camY = camY
    sceneTargets.camZ = camZ

    // la camera è damped QUI (unico owner); i materiali dampano i loro uniform dai target
    cam.position.x = MathUtils.damp(cam.position.x, camX, 3, delta)
    cam.position.y = MathUtils.damp(cam.position.y, camY, 3, delta)
    cam.position.z = MathUtils.damp(cam.position.z, camZ, 3, delta)
    cam.lookAt(0, 0, 0)
  })

  return null
}
