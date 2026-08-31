import { useFrame } from '@react-three/fiber'
import { MathUtils } from 'three'
import { approachMap, progressMap } from '../scroll/progressMap'
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
    const gal = progressMap.gallery
    const str = progressMap.strip
    const crd = progressMap.card
    // la calmata del kinetic si COMPLETA al ~45% della sezione: il testo entra quasi subito
    // (trigger a top 72%) e deve trovare la scena già quieta — non calmarsi mentre esce
    // (finding QA giro 1: drammaturgia rovesciata + contrasto debole)
    const k = MathUtils.clamp(progressMap.kinetic * 2.2, 0, 1)
    const f = progressMap.footer

    // I capitoli «prodotto» (explode → veil → prodgallery): lì il protagonista è il DOM e la
    // scena deve farsi da parte per tutti e tre di fila. Un solo segnale invece di tre: se ognuno
    // gestisse il suo, fra una sezione e l'altra la forma tornerebbe su per un istante — e un
    // lampeggio fra due sezioni si nota molto più di una scena ferma.
    //
    // Il segnale si prende dall'AVVICINAMENTO, non dal progress del pin: quando il pin comincia
    // la sezione riempie già lo schermo, e calmarsi lì significa calmarsi sotto gli occhi di chi
    // guarda. `max` col progress tiene la scena giù anche dentro il capitolo. Dopo il blocco
    // prodotto `e` resta inchiodato a 1 (il progress di ScrollTrigger non torna indietro): sono
    // le tratte successive (gallery in poi) a riprendersi il testimone con le loro lerp.
    const e = MathUtils.clamp(
      Math.max(
        approachMap.explode,
        progressMap.explode * 3,
        approachMap.veil,
        approachMap.prodgallery,
      ),
      0,
      1,
    )

    // morph: 0.15 → 0.35 (hero) → 1.0 (scrub) → 0.08 (blocco prodotto, la scena si fa da parte)
    //        → 0.3 gallery → 0.5 strip → 0.25 card → 0.15 kinetic → 0.9 footer (congedo)
    // Le lerp sono in ORDINE DI PAGINA: quando una tratta parte, la precedente è già a 1 e la sua
    // lerp diventa l'identità. È lo stesso passaggio di testimone delle prime tre tratte, che
    // restano bit-per-bit quelle approvate al terzo giro di QA.
    let morph = 0.15 + 0.2 * h
    morph = MathUtils.lerp(morph, 1.0, s)
    morph = MathUtils.lerp(morph, 0.08, e)
    morph = MathUtils.lerp(morph, 0.3, gal)
    morph = MathUtils.lerp(morph, 0.5, str)
    morph = MathUtils.lerp(morph, 0.25, crd)
    morph = MathUtils.lerp(morph, 0.15, k)
    morph = MathUtils.lerp(morph, 0.9, f)
    sceneTargets.morph = morph

    // il backdrop entra ed esce dentro la sezione gradient, spento dal blocco prodotto e dal
    // kinetic; torna come velo tenue sotto il footer, l'unico altro momento in cui la scena
    // riprende voce. (1-e) e (1-k) sono innocui altrove: dopo la sezione gradient sin(π·g)=0.
    sceneTargets.gradientMix =
      Math.sin(Math.PI * MathUtils.clamp(g, 0, 1)) * (1 - k) * (1 - e) + 0.35 * Math.sin(Math.PI * f)

    // camera: avvicinamento (hero) → deriva (gradient) → orbita (scrub) → in asse e arretrata
    // (blocco prodotto: una deriva laterale dietro una vista esplosa fa sembrare che si muova la
    // pila) → si ritira dietro i contenuti (gallery, strip, card) → arretra (kinetic) → rientra
    // per il congedo (footer). Nei capitoli editoriali il protagonista è il DOM: la scena resta
    // profonda e fuori asse, e nella striscia orizzontale deriva in senso CONTRARIO allo
    // scorrimento — è quel contrasto a far leggere il movimento come profondità.
    // Nel capitolo kinetic il TESTO è il protagonista: su viewport stretti (aspect < 1,
    // mobile portrait) la ritirata cresce, o la forma continua a dominare il framing (QA giro 2).
    const aspect = 'aspect' in cam && typeof cam.aspect === 'number' ? cam.aspect : 1
    const kineticZ = 6.5 + (aspect < 1 ? (1 - aspect) * 4 : 0)
    // Stessa compensazione per il capitolo del prodotto, e più forte: su portrait la forma
    // «calma» resta comunque una sfera che riempie il quadro dietro la vista esplosa, e le
    // annotazioni ci finiscono sopra. Arretrare è l'unico modo per toglierla davvero di mezzo.
    const explodeZ = 8.6 + (aspect < 1 ? (1 - aspect) * 6 : 0)
    let camZ = 6 - 1.5 * h
    camZ = MathUtils.lerp(camZ, 3.2, s)
    camZ = MathUtils.lerp(camZ, explodeZ, e)
    camZ = MathUtils.lerp(camZ, 9.5, gal)
    camZ = MathUtils.lerp(camZ, 8.0, str)
    camZ = MathUtils.lerp(camZ, 9.0, crd)
    camZ = MathUtils.lerp(camZ, kineticZ, k)
    camZ = MathUtils.lerp(camZ, 8.5, f)

    // La striscia deriva per tutta la sua tratta, ma il peso entra in fretta (× 3): se salisse
    // linearmente, a metà sezione la controderiva sarebbe ancora quasi nulla e non si leggerebbe.
    const stripIn = MathUtils.clamp(str * 3, 0, 1)
    const stripDrift = MathUtils.lerp(1.6, -1.6, str)

    // I capitoli hero/gradient/scrub e l'approdo del kinetic restano quelli approvati al terzo
    // giro di QA. Il blocco prodotto è una tratta esplicita che porta la camera in asse (lerp a
    // 0): il vecchio idioma moltiplicativo (1-eCam) serviva quando il capitolo successivo era il
    // kinetic — ora il testimone lo riprende la gallery, nella stessa catena di tutti gli altri.
    let camX = 0.3 * g + Math.sin(s * Math.PI * 0.9) * 1.2
    camX = MathUtils.lerp(camX, 0, e)
    camX = MathUtils.lerp(camX, -1.1, gal)
    camX = MathUtils.lerp(camX, stripDrift, stripIn)
    camX = MathUtils.lerp(camX, 0.9, crd)
    camX = MathUtils.lerp(camX, 0.3, k)
    camX = MathUtils.lerp(camX, 0, f)

    let camY = 0.4 * h + Math.sin(s * Math.PI) * 0.8
    camY = MathUtils.lerp(camY, 0, e)
    camY = MathUtils.lerp(camY, 0.6, gal)
    camY = MathUtils.lerp(camY, -0.4, str)
    camY = MathUtils.lerp(camY, 0.5, crd)
    camY = MathUtils.lerp(camY, 0.2, k)
    camY = MathUtils.lerp(camY, -1.6, f)

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
