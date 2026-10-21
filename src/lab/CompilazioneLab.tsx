import { useEffect, useMemo } from 'react'
import { MeshStandardNodeMaterial, SphereGeometry } from 'three/webgpu'
import { float, vec3 } from 'three/tsl'
import { Stage } from '../canvas/Stage'

// Il laboratorio di carico della compilazione (?lab=compilazione): la scala a cui la compilazione in
// parallelo si vede nei compiti lunghi anche sul Mac (src/canvas/compilazioneParallela.ts). La demo
// del kit compila 6 programmi al caricamento, ~27 ms di attese sul Mac: troppo poco per spostare i
// fotogrammi lunghi, mentre su un iPhone la stessa traduzione GLSL → Metal costa cento volte tanto.
// Qui `&programmi=N` sfere (48 di default), tutte in quadro, ognuna con un letterale diverso cotto
// nel suo grafo TSL: N programmi distinti nel primo fotogramma. È proprio l'anti-schema che
// `qa:compilazioni` vieta nelle fabbriche del kit (references/webgpu-tsl.md §4.4), usato qui apposta
// per moltiplicare la compilazione. Lo misura `npm run qa:parallela`, con e senza `&sincrono`.
//
// Niente `dispose()` nel cleanup di un effetto: in dev lo StrictMode lo eseguirebbe subito dopo il
// montaggio, three rilascerebbe i programmi e li ricompilerebbe, e la misura conterebbe il doppio.
// Il laboratorio occupa la pagina e non si smonta mai.

const parametri = new URLSearchParams(window.location.search)
const N = Math.max(1, Math.min(256, Number(parametri.get('programmi') ?? 48)))
// `&sale=k` sposta i letterali di un niente: sorgenti mai visti, quindi la cache degli shader del
// sistema non li ha e ogni visita compila a freddo, come la prima visita da un telefono
const SALE = Number(parametri.get('sale') ?? 0) * 1e-7
const COLONNE = 6

function Sfere() {
  const geometria = useMemo(() => new SphereGeometry(0.2, 32, 16), [])
  const materiali = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => {
        const m = new MeshStandardNodeMaterial({ roughness: 0.5 })
        // un letterale diverso per sfera: un fragment shader diverso, cioè un programma in più
        m.colorNode = vec3(0.25, 0.45, 0.85).mul(float(0.4 + (0.6 * i) / N + SALE))
        return m
      }),
    [],
  )
  // il gate riconosce il laboratorio da questa riga: senza, misurerebbe un'altra pagina
  useEffect(() => console.info(`[kit] laboratorio compilazione: ${N} programmi`), [])
  const righe = Math.ceil(N / COLONNE)
  return (
    <>
      <directionalLight position={[2, 3, 4]} intensity={2} />
      <ambientLight intensity={0.4} />
      {materiali.map((m, i) => (
        <mesh
          key={i}
          geometry={geometria}
          material={m}
          // in quadro anche a taglia telefono, e mai scartate: three compila solo ciò che disegna
          position={[((i % COLONNE) - (COLONNE - 1) / 2) * 0.48, ((righe - 1) / 2 - Math.floor(i / COLONNE)) * 0.62, 0]}
          frustumCulled={false}
        />
      ))}
    </>
  )
}

export default function CompilazioneLab() {
  return (
    <div className="canvas-layer" aria-hidden="true" style={{ position: 'fixed', inset: 0 }}>
      <Stage dpr={[1, 1]} cameraPosition={[0, 0, 8]}>
        <Sfere />
      </Stage>
    </div>
  )
}
