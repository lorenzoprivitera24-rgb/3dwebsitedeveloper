#!/usr/bin/env node
// encode-assets.mjs — offline asset pipeline (ROADMAP: asset pipeline as a command, not prose).
//
// GLB/GLTF → dedup/weld/prune/quantize + Meshopt (default; Draco with --draco) and textures
// → KTX2 (ETC1S/UASTC decided per-texture by gltf-transform) when KTX-Software is installed,
// otherwise falls back to WebP with a loud warning.
//
// Runtime counterparts (self-hosted, GDPR): /public/basis (KTX2 transcoder), /public/draco
// (Draco decoder) — copied from node_modules/three/examples/jsm/libs/{basis,draco/gltf}.
//
// Usage:
//   node scripts/encode-assets.mjs                       # all GLB/GLTF in public/assets/raw → public/assets
//   node scripts/encode-assets.mjs in.glb [out.glb]      # single file
//   Flags: --draco            use Draco instead of Meshopt (static hero geometry only)
//          --texture-size N   max texture side (default 2048)
//          --no-ktx2          skip KTX2 even if toktx is available
//
// Budgets to respect (CLAUDE.md / deep-dive): total GLB per page < 5 MB compressed,
// hero textures ≤ 2048px, everything mipmapped.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { basename, extname, join, resolve } from 'node:path'

const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(name)
  if (i !== -1) args.splice(i, 1)
  return i !== -1
}
const opt = (name, fallback) => {
  const i = args.indexOf(name)
  if (i === -1) return fallback
  const v = args[i + 1]
  args.splice(i, 2)
  return v
}

const useDraco = flag('--draco')
const noKtx2 = flag('--no-ktx2')
const textureSize = Number(opt('--texture-size', '2048'))

function hasKtxSoftware() {
  for (const bin of ['toktx', 'ktx']) {
    try {
      execFileSync(bin, ['--version'], { stdio: 'ignore' })
      return true
    } catch {
      /* not this one */
    }
  }
  return false
}

const ktxAvailable = !noKtx2 && hasKtxSoftware()
if (!noKtx2 && !ktxAvailable) {
  console.warn(
    '\n⚠️  KTX-Software (toktx) non trovato: le texture usciranno in WebP, NON in KTX2.\n' +
      '   WebP si decomprime in VRAM piena — su mobile è il collo di bottiglia vero.\n' +
      '   Installa KTX-Software: https://github.com/KhronosGroup/KTX-Software/releases\n',
  )
}

const mb = (bytes) => (bytes / 1e6).toFixed(2) + ' MB'

function encodeOne(input, output) {
  const before = statSync(input).size
  const cliArgs = [
    '--no-install',
    'gltf-transform',
    'optimize',
    input,
    output,
    '--compress',
    useDraco ? 'draco' : 'meshopt',
    '--texture-compress',
    ktxAvailable ? 'ktx2' : 'webp',
    '--texture-size',
    String(textureSize),
  ]
  execFileSync('npx', cliArgs, { stdio: ['ignore', 'inherit', 'inherit'] })
  const after = statSync(output).size
  console.log(
    `✓ ${basename(input)}  ${mb(before)} → ${mb(after)}  (−${Math.round((1 - after / before) * 100)}%)`,
  )
  return after
}

const RAW_DIR = resolve('public/assets/raw')
const OUT_DIR = resolve('public/assets')

let total = 0
if (args[0]) {
  const input = resolve(args[0])
  const output = resolve(args[1] ?? input.replace(/(\.glb|\.gltf)$/i, '.opt.glb'))
  total = encodeOne(input, output)
} else {
  if (!existsSync(RAW_DIR)) {
    console.error(`Nessun input: crea ${RAW_DIR} e mettici i GLB/GLTF grezzi, oppure passa un file.`)
    process.exit(1)
  }
  const files = readdirSync(RAW_DIR).filter((f) => ['.glb', '.gltf'].includes(extname(f).toLowerCase()))
  if (files.length === 0) {
    console.error(`Nessun GLB/GLTF in ${RAW_DIR}.`)
    process.exit(1)
  }
  mkdirSync(OUT_DIR, { recursive: true })
  for (const f of files) {
    total += encodeOne(join(RAW_DIR, f), join(OUT_DIR, f.replace(/\.gltf$/i, '.glb')))
  }
}

console.log(`\nTotale ottimizzato: ${mb(total)} — budget di pagina: < 5 MB di GLB compressi.`)
if (total > 5e6) {
  console.warn('⚠️  SFORI IL BUDGET di 5 MB: riduci i poligoni (Blender headless) o le texture.')
  process.exitCode = 2
}
