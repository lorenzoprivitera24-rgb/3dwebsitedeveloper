import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  DoubleSide,
  RepeatWrapping,
  SRGBColorSpace,
  Vector3,
  type Group,
  type Mesh,
  type MeshStandardMaterial,
  type Texture,
} from 'three'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useGLTF, useTexture } from '@react-three/drei'
// SOLO tipi: i corpi, i collider e i giunti passano dal palco
import type { RapierRigidBody, RigidBodyProps } from '@react-three/rapier'
import { PhysicsBody, PhysicsCollider, PhysicsJoint, usePhysics } from './PhysicsStage'
// gli asset dello scaffale, così come sono: il .glb non è un asset noto a Vite, quindi ?url
import cardGlb from '../../../lib/react-bits/Components/Lanyard/card.glb?url'
import lanyardPng from '../../../lib/react-bits/Components/Lanyard/lanyard.png'

// Il Lanyard di React Bits (lib/react-bits/Components/Lanyard/Lanyard.tsx) portato sul palco
// fisico del kit. Lo scaffale resta com'è (è la sorgente che sync:global rispecchia, e il suo file
// importa rapier per valore e monta un <Canvas> e un <Physics> suoi: copiato in src, perf:check
// boccia la build). Questa è la variante del kit, e cambia questo:
// - corpi, collider e giunti sono PhysicsBody, PhysicsCollider e PhysicsJoint: il motore si
//   scarica solo a fisica accesa, e il Lanyard sta dentro il PhysicsStage della scena che lo ospita
//   (niente Canvas, luci ed Environment suoi: li mette la scena);
// - a fisica spenta (tier low, reduced-motion) pende fermo, dritto, nella posa di riposo; la card
//   non si trascina. Con la fisica parte dalla posa di React Bits, gli anelli in orizzontale, ma con
//   la card già appesa al suo anello: là parte a fianco e il giunto sferico è violato di 1,5 al
//   primo passo, e il risolutore la strattona su;
// - la gravità del palco è -9,81 e React Bits ne usa una sua di -40: qui ogni corpo ha
//   gravityScale 40 / 9,81, così il moto resta quello e gli altri corpi del mondo non cambiano;
// - la fettuccia: meshline disegna con un ShaderMaterial GLSL, che il renderer a nodi del kit
//   (three/webgpu) non sa rendere. Qui è un nastro rivolto alla camera, ricostruito a ogni
//   fotogramma lungo la stessa curva, con la stessa texture ripetuta 4 volte e la larghezza che
//   lineWidth 1 dava con la camera di React Bits (fov 20); e rispetta la profondità (là no);
// - `position` è l'aggancio fisso, `scale` scala tutto (corde, collider, card, nastro);
// - niente pixel vuoti al posto delle facce che mancano (su WebKit non si caricano: vedi sotto);
// - il .glb si carica senza Draco, cioè senza il decoder dalla CDN di Google che drei imposta di
//   default (GDPR); la card di React Bits non è compressa.

// Le misure di React Bits, a scala 1.
const ROPE = 1 // lunghezza massima di ogni tratto di corda
const LINK_SPACING = 0.5 // anelli nella posa di partenza, in orizzontale
const LINK_RADIUS = 0.1
const CARD_HALF = [0.8, 1.125, 0.01] as const // il collider della card
const CARD_HOOK = [0, 1.45, 0] as const // dove la card si aggancia all'ultimo anello
const CARD_MODEL_SCALE = 2.25
const CARD_MODEL_OFFSET = [0, -1.2, -0.05] as const
const DAMPING = 4
const GRAVITY_SCALE = 40 / 9.81
// meshline con lineWidth 1 e attenuazione: largo lineWidth * tan(fov / 2), con il fov 20 di React Bits
const BAND_WIDTH = Math.tan((10 * Math.PI) / 180)
const BAND_REPEAT = -4
const BAND_DIVISIONS = 32

/** Il contratto della catena, per chi la misura (la sonda di qa:lab): nomi e misure a scala 1. */
export const LANYARD = {
  /** il gruppo della card, che si muove col suo corpo */
  card: 'lanyard-card',
  /** i giunti nel mondo: tre corde e l'aggancio sferico della card */
  joints: 4,
  rope: ROPE,
} as const

type Triple = [number, number, number]
const times = (v: readonly number[], s: number): Triple => [v[0] * s, v[1] * s, v[2] * s]

// La posa di partenza con la fisica (anelli in orizzontale verso +x, card appesa all'ultimo) e
// quella di riposo senza (tutto appeso in verticale, corde tese), nel sistema dell'aggancio.
function poses(s: number) {
  const link = (i: number, hanging: boolean): Triple => (hanging ? [0, -ROPE * i * s, 0] : [LINK_SPACING * i * s, 0, 0])
  const card = (hanging: boolean): Triple => {
    const [x, y, z] = link(3, hanging)
    return [x - CARD_HOOK[0] * s, y - CARD_HOOK[1] * s, z - CARD_HOOK[2] * s]
  }
  return {
    start: { links: [1, 2, 3].map((i) => link(i, false)), card: card(false) },
    rest: { links: [1, 2, 3].map((i) => link(i, true)), card: card(true) },
  }
}

// La faccia davanti della card è mappata sulla metà SINISTRA dell'atlante, il retro sulla destra
// (misurato da React Bits su card.glb): ogni immagine va nella sua metà, senza deformarla.
const FRONT_UV_RECT = { x: 0, y: 0, w: 0.5, h: 0.755 }
const BACK_UV_RECT = { x: 0.5, y: 0, w: 0.5, h: 0.757 }

interface CardModel {
  nodes: { card: Mesh; clip: Mesh; clamp: Mesh }
  materials: { base: MeshStandardMaterial; metal: MeshStandardMaterial }
}

export interface LanyardProps {
  /** l'aggancio fisso in alto, nel sistema del genitore: la catena pende da qui */
  position?: Triple
  /** scala d'insieme (corde, collider, card, nastro): 1 = le misure di React Bits */
  scale?: number
  frontImage?: string | null
  backImage?: string | null
  imageFit?: 'cover' | 'contain'
  lanyardImage?: string | null
  /** larghezza del nastro, in multipli di quella di React Bits */
  lanyardWidth?: number
  /** inseguimento del nastro dietro gli anelli (React Bits: 0 e 50) */
  minSpeed?: number
  maxSpeed?: number
  /** il clearcoat della card: React Bits lo spegne sotto i 768 px */
  clearcoat?: number
}

export function Lanyard({
  position = [0, 4, 0],
  scale = 1,
  frontImage = null,
  backImage = null,
  imageFit = 'cover',
  lanyardImage = null,
  lanyardWidth = 1,
  minSpeed = 0,
  maxSpeed = 50,
  clearcoat = 1,
}: LanyardProps) {
  const physics = usePhysics() !== null
  const anchor = useRef<Group>(null)
  const fixed = useRef<RapierRigidBody>(null)
  const j1 = useRef<RapierRigidBody>(null)
  const j2 = useRef<RapierRigidBody>(null)
  const j3 = useRef<RapierRigidBody>(null)
  const card = useRef<RapierRigidBody>(null)

  const { start, rest } = useMemo(() => poses(scale), [scale])
  const pose = physics ? start : rest

  const { nodes, materials } = useGLTF(cardGlb, false) as unknown as CardModel
  // Una chiamata sola, con le sole immagini che ci sono: React Bits carica un pixel vuoto 1x1 per
  // la faccia che manca, drei lo carica sulla GPU anche se nessun materiale lo usa, e su WebKit
  // quel PNG grigio con alfa non si carica («texSubImage2D: bad image data», misurato il 22 ott
  // 2026 col laboratorio su webkit-2359).
  const [texture, ...faces] = useTexture([lanyardImage || lanyardPng, ...[frontImage, backImage].filter((u) => u != null)])
  const frontTex = frontImage ? faces[0] : null
  const backTex = backImage ? faces[frontImage ? 1 : 0] : null
  // quello che React Bits imposta con le prop trafitte (map-anisotropy, material-roughness): il
  // materiale del metallo è uno solo, condiviso da clip e morsetto, e lo è anche là
  useEffect(() => {
    texture.wrapS = texture.wrapT = RepeatWrapping
    texture.colorSpace = SRGBColorSpace
    texture.needsUpdate = true
    materials.metal.roughness = 0.3
  }, [texture, materials.metal])

  // Le immagini davanti e dietro composte nell'atlante della card, ognuna nella sua metà.
  const cardMap = useMemo(() => {
    const baseMap = materials.base.map as Texture
    if (!frontImage && !backImage) return baseMap
    const baseImg = baseMap.image as HTMLImageElement
    const W = baseImg.width
    const H = baseImg.height
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) return baseMap
    ctx.drawImage(baseImg, 0, 0, W, H)
    const drawFitted = (img: HTMLImageElement, rect: typeof FRONT_UV_RECT) => {
      const rx = rect.x * W
      const ry = rect.y * H
      const rw = rect.w * W
      const rh = rect.h * H
      const pick = imageFit === 'contain' ? Math.min : Math.max
      const k = pick(rw / img.width, rh / img.height)
      const dw = img.width * k
      const dh = img.height * k
      ctx.save()
      ctx.beginPath()
      ctx.rect(rx, ry, rw, rh)
      ctx.clip()
      ctx.drawImage(img, rx + (rw - dw) / 2, ry + (rh - dh) / 2, dw, dh)
      ctx.restore()
    }
    if (frontTex?.image) drawFitted(frontTex.image as HTMLImageElement, FRONT_UV_RECT)
    if (backTex?.image) drawFitted(backTex.image as HTMLImageElement, BACK_UV_RECT)
    const composite = new CanvasTexture(canvas)
    composite.colorSpace = SRGBColorSpace
    composite.flipY = baseMap.flipY
    composite.needsUpdate = true
    return composite
  }, [frontImage, backImage, imageFit, frontTex, backTex, materials.base.map])
  useEffect(() => {
    cardMap.anisotropy = 16
    cardMap.needsUpdate = true
  }, [cardMap])

  const bandGeometry = useMemo(makeBandGeometry, [])
  useEffect(() => () => bandGeometry.dispose(), [bandGeometry])
  const scratch = useMemo(
    () => ({
      curve: new CatmullRomCurve3([new Vector3(), new Vector3(), new Vector3(), new Vector3()], false, 'chordal'),
      points: Array.from({ length: BAND_DIVISIONS + 1 }, () => new Vector3()),
      eye: new Vector3(),
      // gli anelli 1 e 2 come li insegue il nastro, nel mondo; `following` finché la fisica non parte è false
      lerped: [new Vector3(), new Vector3()],
      following: false,
      at: new Vector3(),
      vec: new Vector3(),
      dir: new Vector3(),
    }),
    [],
  )
  const [dragged, drag] = useState<false | Vector3>(false)
  const [hovered, hover] = useState(false)

  useEffect(() => {
    if (!hovered) return
    document.body.style.cursor = dragged ? 'grabbing' : 'grab'
    return () => {
      document.body.style.cursor = 'auto'
    }
  }, [hovered, dragged])

  useFrame((state, delta) => {
    const frame = anchor.current
    if (!frame) return
    const { curve, points, eye, lerped, at, vec, dir } = scratch
    const [p0, p1, p2, p3] = curve.points
    const f = fixed.current
    const b1 = j1.current
    const b2 = j2.current
    const b3 = j3.current
    const c = card.current
    if (physics && f && b1 && b2 && b3 && c) {
      if (dragged) {
        vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera)
        dir.copy(vec).sub(state.camera.position).normalize()
        vec.add(dir.multiplyScalar(state.camera.position.length()))
        for (const b of [f, b1, b2, b3, c]) b.wakeUp()
        c.setNextKinematicTranslation({ x: vec.x - dragged.x, y: vec.y - dragged.y, z: vec.z - dragged.z })
      }
      // il nastro insegue gli anelli 1 e 2 con un ritardo che cresce con la distanza (React Bits)
      const follow = (body: RapierRigidBody, l: Vector3) => {
        at.copy(body.translation())
        if (!scratch.following) l.copy(at)
        const distance = Math.max(0.1, Math.min(1, l.distanceTo(at)))
        l.lerp(at, delta * (minSpeed + distance * (maxSpeed - minSpeed)))
      }
      follow(b1, lerped[0])
      follow(b2, lerped[1])
      scratch.following = true
      frame.worldToLocal(p0.copy(b3.translation()))
      frame.worldToLocal(p1.copy(lerped[1]))
      frame.worldToLocal(p2.copy(lerped[0]))
      frame.worldToLocal(p3.copy(f.translation()))
      // la card torna di fronte: smorza la rotazione attorno all'asse verticale (React Bits)
      const w = c.angvel()
      const r = c.rotation()
      c.setAngvel({ x: w.x, y: w.y - r.y * 0.25, z: w.z }, true)
    } else {
      // ferma: la curva passa per la posa del markup
      p0.fromArray(pose.links[2])
      p1.fromArray(pose.links[1])
      p2.fromArray(pose.links[0])
      p3.set(0, 0, 0)
    }
    for (let i = 0; i <= BAND_DIVISIONS; i++) curve.getPoint(i / BAND_DIVISIONS, points[i])
    frame.worldToLocal(eye.copy(state.camera.position))
    writeBand(points, eye, (BAND_WIDTH * lanyardWidth * scale) / 2, bandGeometry.getAttribute('position') as BufferAttribute)
  })

  const link: RigidBodyProps = {
    type: 'dynamic',
    canSleep: true,
    colliders: false,
    angularDamping: DAMPING,
    linearDamping: DAMPING,
    gravityScale: GRAVITY_SCALE,
  }
  // trascinare la card ha senso solo con la fisica
  const handlers = physics
    ? {
        onPointerOver: () => hover(true),
        onPointerOut: () => hover(false),
        onPointerUp: (e: ThreeEvent<PointerEvent>) => {
          const target = e.target as Element
          target.releasePointerCapture(e.pointerId)
          drag(false)
        },
        onPointerDown: (e: ThreeEvent<PointerEvent>) => {
          const c = card.current
          if (!c) return
          const target = e.target as Element
          target.setPointerCapture(e.pointerId)
          drag(new Vector3().copy(e.point).sub(new Vector3().copy(c.translation())))
        },
      }
    : {}

  return (
    <group ref={anchor} position={position}>
      <PhysicsBody ref={fixed} {...link} type="fixed" />
      {pose.links.map((at, i) => (
        <PhysicsBody key={i} ref={[j1, j2, j3][i]} position={at} {...link}>
          <PhysicsCollider shape="ball" args={[LINK_RADIUS * scale]} />
        </PhysicsBody>
      ))}
      <PhysicsBody ref={card} position={pose.card} {...link} type={dragged ? 'kinematicPosition' : 'dynamic'}>
        <PhysicsCollider shape="cuboid" args={times(CARD_HALF, scale)} />
        <group name={LANYARD.card} scale={CARD_MODEL_SCALE * scale} position={times(CARD_MODEL_OFFSET, scale)} {...handlers}>
          <mesh geometry={nodes.card.geometry}>
            <meshPhysicalNodeMaterial
              map={cardMap}
              clearcoat={clearcoat}
              clearcoatRoughness={0.15}
              roughness={0.9}
              metalness={0.8}
            />
          </mesh>
          <mesh geometry={nodes.clip.geometry} material={materials.metal} />
          <mesh geometry={nodes.clamp.geometry} material={materials.metal} />
        </group>
      </PhysicsBody>
      {/* i giunti DOPO i corpi: rapier li crea nel suo effetto, coi corpi già nei ref */}
      <PhysicsJoint type="rope" body1={fixed} body2={j1} params={[[0, 0, 0], [0, 0, 0], ROPE * scale]} />
      <PhysicsJoint type="rope" body1={j1} body2={j2} params={[[0, 0, 0], [0, 0, 0], ROPE * scale]} />
      <PhysicsJoint type="rope" body1={j2} body2={j3} params={[[0, 0, 0], [0, 0, 0], ROPE * scale]} />
      <PhysicsJoint type="spherical" body1={j3} body2={card} params={[[0, 0, 0], times(CARD_HOOK, scale)]} />
      <mesh geometry={bandGeometry} frustumCulled={false}>
        <meshBasicNodeMaterial map={texture} side={DoubleSide} />
      </mesh>
    </group>
  )
}

// Il nastro: due vertici per punto della curva, uno per lato, con la texture ripetuta lungo la
// lunghezza; le posizioni le riscrive writeBand a ogni fotogramma. Indicizzato: three r185 su
// WebGL2 perde gli indici dei VAO, e qa:indici guarda proprio i disegni senza.
function makeBandGeometry(): BufferGeometry {
  const n = BAND_DIVISIONS + 1
  const geometry = new BufferGeometry()
  const uv = new Float32Array(n * 4)
  const index: number[] = []
  for (let i = 0; i < n; i++) {
    const u = (i / (n - 1)) * BAND_REPEAT
    uv.set([u, 0, u, 1], i * 4)
    if (i < n - 1) index.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2)
  }
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(n * 6), 3))
  geometry.setAttribute('uv', new BufferAttribute(uv, 2))
  geometry.setIndex(index)
  return geometry
}

// Ogni punto si allarga di mezza larghezza per lato, perpendicolare alla curva e alla direzione
// della camera: il nastro le mostra sempre la faccia, come meshline.
const tangent = new Vector3()
const view = new Vector3()
const side = new Vector3()
function writeBand(points: Vector3[], eye: Vector3, halfWidth: number, position: BufferAttribute) {
  const last = points.length - 1
  points.forEach((p, i) => {
    tangent.subVectors(points[Math.min(i + 1, last)], points[Math.max(i - 1, 0)])
    side.crossVectors(tangent, view.subVectors(eye, p))
    const length = side.length()
    if (length > 1e-9) side.multiplyScalar(halfWidth / length)
    else side.set(halfWidth, 0, 0)
    position.setXYZ(2 * i, p.x + side.x, p.y + side.y, p.z + side.z)
    position.setXYZ(2 * i + 1, p.x - side.x, p.y - side.y, p.z - side.z)
  })
  position.needsUpdate = true
}
