---
name: scroll-scene-choreography
description: >
  Come tradurre una riga di storyboard in keyframe di camera/materiali sulla scena persistente:
  progress map per sezione, camera director unico, percorsi CatmullRom, convivenza DOM+canvas.
  Usare quando si implementa lo storyboard (S5), si lega lo scroll alla scena, o la camera "salta"
  tra sezioni. Trigger: "camera allo scroll", "la scena si trasforma tra le sezioni", "keyframe di
  camera", "implementa lo storyboard".
---

# Scroll-scene choreography — dal foglio alla scena persistente

Principio: **lo scroll lo governa GSAP, la scena lo subisce.** Il DOM detta start/end; la scena
legge progress già lisciati. Mai `ScrollControls` di drei (possiede lo scroll → confligge con
Lenis+ScrollTrigger).

## Il pattern a due lati (progress map + camera director)

**Lato DOM** (scroll-motion-engineer): un trigger per sezione scrive il proprio progress 0→1 in
una mappa dentro ref/store (MAI React state a 60fps — kit rule #4):

```ts
ScrollTrigger.create({
  trigger: el, start: 'top bottom', end: 'bottom top', scrub: true,
  onUpdate: (self) => { progressMap.current[sectionId] = self.progress },
})
```

**Lato scena** (r3f-scene-architect): UN solo `useFrame` — il *camera director* — consuma la
mappa e possiede camera + uniform di scena. Nessun altro tocca la camera (kit rule #2).

```ts
useFrame((_, dt) => {
  const p = progressMap.current.hero ?? 0
  camera.position.lerpVectors(camA, camB, ease(p))          // tratte semplici
  gradientUniforms.flow.value = MathUtils.damp(gradientUniforms.flow.value, 0.1 + p * 0.2, 4, dt)
})
```

## Tradurre una riga di storyboard

«S3: camera da fronte-prodotto a vista-zenitale, materiale da opaco a iridescente, 250vh, pin» →
1. keyframe: `camA/camB` (posizione+target) + uniform `iridescenza: 0→1`;
2. trigger pinnato con `end: '+=250%'`, scrub, che scrive `progressMap.s3`;
3. director: tratta dedicata quando `s3 > 0` (le sezioni si passano il testimone: la fine dello
   stato B di S3 È lo stato A di S4 — scrivilo esplicito, è il punto dove i siti "saltano").

## Percorsi complessi: CatmullRom

Per camere che viaggiano (fly-through): `new THREE.CatmullRomCurve3(punti)` campionata dal
progress (`curve.getPointAt(ease(p))` + `lookAt` su una seconda curva di target). I punti della
curva stanno in un modulo dedicato per sezione, commentati con la riga di storyboard che
implementano. Debug: esporre `?pose=<sezione>:<p>` che forza il progress — la verifica headless
non sa scrollare Lenis in modo affidabile ([[webgpu-tsl-runtime-gotchas]] → verifica camera-driven).

## Convivenza DOM ↔ canvas

- Il testo si posiziona col layout DOM normale; la scena inquadra in funzione delle safe-area
  del testo (storyboard le dichiara), non il contrario.
- `drei <View>` per oggetti "in bounding box" dentro il layout: stessa GL, niente secondo canvas.
- Reduced-motion: il director salta le tratte e si mette sullo stato B fisso di ogni sezione
  (gli stati statici sono NEL contratto dello storyboard).

## Checklist di implementazione

Un owner per proprietà spuntato · progress in ref · damp su tutto ciò che arriva a
camera/uniform · testimone tra sezioni esplicito · reduced-motion = stati B statici ·
`npm run qa:verify` prima di dichiarare "fatto".
