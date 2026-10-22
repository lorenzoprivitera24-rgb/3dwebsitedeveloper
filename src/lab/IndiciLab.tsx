import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BoxGeometry, InstancedMesh, MeshBasicNodeMaterial } from 'three/webgpu'
import { Stage } from '../canvas/Stage'

// Il laboratorio del difetto dei VAO (?lab=indici): riproduce a comando, sul ripiego WebGL2, ciò
// che in SILKET faceva la compilazione in parallelo a chi scorreva durante il caricamento
// (src/canvas/indiciWebGL.ts). Tre disegni di fila nello stesso render, in quest'ordine:
//   A1 una mesh con la geometria G, indicizzata: dopo il suo disegno il suo VAO resta legato;
//   B  un'InstancedMesh a ZERO istanze: three ne carica gli indici col VAO di A1 legato, poi
//      `backend.draw` la salta (drawParams null), quindi nessuno rilega niente;
//   A2 un'altra mesh con la stessa G e lo stesso materiale: stesso VAO di A1, il tracciatore di
//      three non rilega, e senza la cura disegna senza indici (INVALID_OPERATION, A2 manca).
// B carica i suoi indici a ogni fotogramma, per le due strade che la cura avvolge:
// `&via=crea` una geometria nuova (createAttribute), `&via=aggiorna` gli stessi indici segnati
// da ricaricare (updateAttribute); senza `via` le due si alternano. Con la cura: zero errori;
// con `&indici=nudi` (cura spenta) uno per fotogramma. Lo legge `npm run qa:indici`.
// Su WebGPU il laboratorio gira ma non prova niente: lì gli indici non sono stato.

const via = new URLSearchParams(window.location.search).get('via')

function Trappola() {
  const geometria = useMemo(() => new BoxGeometry(0.9, 0.9, 0.9), [])
  const materiale = useMemo(() => new MeshBasicNodeMaterial({ color: '#7ba05b' }), [])
  const vuota = useMemo(() => {
    const m = new InstancedMesh(new BoxGeometry(0.4, 0.4, 0.4), materiale, 1)
    // zero istanze: la geometria si carica, il disegno no
    m.count = 0
    // con zero istanze la sfera di contorno è vuota: senza questo il frustum la scarterebbe
    // prima ancora di caricarla, e la trappola non scatterebbe
    m.frustumCulled = false
    return m
  }, [materiale])

  // il gate riconosce il laboratorio da questa riga: senza, misurerebbe un'altra pagina
  useEffect(() => console.info(`[kit] laboratorio indici: via=${via ?? 'alterna'}`), [])

  useEffect(
    () => () => {
      geometria.dispose()
      vuota.geometry.dispose()
      vuota.dispose()
      materiale.dispose()
    },
    [geometria, materiale, vuota],
  )

  const giro = useRef(0)
  useFrame(() => {
    const crea = via === 'crea' || (via !== 'aggiorna' && giro.current % 2 === 0)
    giro.current++
    if (crea) {
      const vecchia = vuota.geometry
      // la geometria nuova a ogni fotogramma È la trappola: fa passare three da createAttribute
      // eslint-disable-next-line @react-three/no-new-in-loop
      vuota.geometry = new BoxGeometry(0.4, 0.4, 0.4)
      vecchia.dispose()
    } else if (vuota.geometry.index) {
      vuota.geometry.index.needsUpdate = true
    }
  })

  // renderOrder fissa l'ordine dei tre disegni (gli opachi si ordinano prima per renderOrder)
  return (
    <>
      <mesh geometry={geometria} material={materiale} position={[-1.1, 0, 0]} renderOrder={0} />
      <primitive object={vuota} renderOrder={1} />
      <mesh geometry={geometria} material={materiale} position={[1.1, 0, 0]} renderOrder={2} />
    </>
  )
}

export default function IndiciLab() {
  return (
    <div className="canvas-layer" aria-hidden="true" style={{ position: 'fixed', inset: 0 }}>
      <Stage dpr={[1, 1]} cameraPosition={[0, 0, 5]}>
        <Trappola />
      </Stage>
    </div>
  )
}
