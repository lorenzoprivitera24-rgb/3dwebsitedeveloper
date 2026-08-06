#!/usr/bin/env node
// gen-cutout-fixture.mjs — la fixture per lavorare sulla COREOGRAFIA senza fotografia vera.
//
// Il blueprint 13 (product-explode) va provato su strati veri: registrazione condivisa, ombre,
// srcset, tempi. Ma un kit non può spedire foto di prodotto altrui, e aspettare gli scontornati
// del cliente per capire se il movimento funziona è il modo giusto per scoprire tardi che non
// funziona. Questa fixture disegna un oggetto astratto a 5 strati — palette del kit, sagome
// nette, alpha vera — sulla STESSA tela per tutti gli strati, come pretende encode-cutouts.
//
// In produzione questi file li sostituisce l'asset-wrangler (S4) con gli scontornati veri, con
// lo stesso identico contratto: NN-<nome>.png, tela condivisa, NN crescente = dal basso in alto.
//
//   node scripts/gen-cutout-fixture.mjs   →  public/assets/raw/cutouts/stack/*.png
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

// Scala 2×: l'oggetto deve uscire abbastanza grande da alimentare le larghezze responsive
// (720/1200) senza che l'encoder debba ingrandire — uno scontornato ingrandito si vede subito.
const S = 2.4
const SIZE = 1400 * S
const CX = SIZE / 2
const OUT = 'public/assets/raw/cutouts/stack'

// Un «cilindro» in proiezione isometrica povera: ellisse superiore + corpo + ellisse inferiore.
// Basta a leggere lo stacco fra strati quando la pila si apre — che è tutto quello che serve
// per giudicare la coreografia.
function cylinder({ id, rx, ry, cyTop, h, top, body, bottom, rim }) {
  const cyBottom = cyTop + h
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <defs>
    <linearGradient id="body-${id}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${bottom}"/>
      <stop offset="0.32" stop-color="${body}"/>
      <stop offset="0.68" stop-color="${body}"/>
      <stop offset="1" stop-color="${bottom}"/>
    </linearGradient>
    <linearGradient id="face-${id}" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0" stop-color="${rim}"/>
      <stop offset="1" stop-color="${top}"/>
    </linearGradient>
    <clipPath id="clip-${id}">
      <rect x="${CX - rx}" y="${cyTop}" width="${rx * 2}" height="${h}"/>
    </clipPath>
  </defs>
  <!-- corpo: ellisse bassa allungata e ritagliata, così i fianchi restano curvi -->
  <g clip-path="url(#clip-${id})">
    <ellipse cx="${CX}" cy="${cyBottom}" rx="${rx}" ry="${ry}" fill="url(#body-${id})"/>
    <rect x="${CX - rx}" y="${cyTop}" width="${rx * 2}" height="${h}" fill="url(#body-${id})"/>
  </g>
  <ellipse cx="${CX}" cy="${cyBottom}" rx="${rx}" ry="${ry}" fill="url(#body-${id})"/>
  <!-- faccia superiore -->
  <ellipse cx="${CX}" cy="${cyTop}" rx="${rx}" ry="${ry}" fill="url(#face-${id})"/>
  <!-- lume: un arco chiaro sul bordo alto a sinistra, l'unica cosa che dice «è illuminato» -->
  <path d="M ${CX - rx * 0.92} ${cyTop} a ${rx * 0.92} ${ry * 0.92} 0 0 1 ${rx * 1.1} ${-ry * 0.62}"
        fill="none" stroke="#ffffff" stroke-opacity="0.42" stroke-width="${Math.max(3, ry * 0.09)}" stroke-linecap="round"/>
</svg>`
}

// Dal basso verso l'alto: la numerazione È l'ordine di impilamento.
// Proporzioni: ellissi basse (ry ≈ rx/5) e corpi alti. Se le ellissi sono grasse la pila legge
// come tre fasce invece che cinque strati, e a quel punto l'esplosione non si capisce.
const LAYERS = [
  { file: '01-basamento', rx: 250, ry: 48, cyTop: 954, h: 96, top: '#39435c', body: '#242b3b', bottom: '#141926', rim: '#5a6884' },
  { file: '02-nucleo',    rx: 230, ry: 44, cyTop: 868, h: 92, top: '#5b8cff', body: '#3c62c4', bottom: '#24387a', rim: '#9db8ff' },
  { file: '03-lamina',    rx: 246, ry: 47, cyTop: 834, h: 40, top: '#dfe6f5', body: '#aab6cd', bottom: '#7f8ba3', rim: '#ffffff' },
  { file: '04-scocca',    rx: 226, ry: 43, cyTop: 744, h: 96, top: '#455072', body: '#2b334a', bottom: '#181d2b', rim: '#6b7899' },
  { file: '05-cupola',    rx: 242, ry: 46, cyTop: 674, h: 76, top: '#eef1f7', body: '#c3ccdd', bottom: '#8e99ad', rim: '#ffffff' },
]

mkdirSync(OUT, { recursive: true })

for (const raw of LAYERS) {
  const layer = { ...raw, rx: raw.rx * S, ry: raw.ry * S, cyTop: raw.cyTop * S, h: raw.h * S }
  const svg = cylinder({ id: layer.file, ...layer })
  const out = join(OUT, `${layer.file}.png`)
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(out)
  console.log(`· ${out}`)
}

console.log(`\n✓ ${LAYERS.length} strati su tela condivisa ${SIZE}×${SIZE} → ${OUT}`)
console.log(`  ora: node scripts/encode-cutouts.mjs stack`)
