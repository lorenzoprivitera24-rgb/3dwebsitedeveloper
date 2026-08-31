import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Serve al gate S7: senza manifest, perf-check non può distinguere il grafo statico
    // dell'entry dai chunk caricati su richiesta, e finirebbe per sommare tutto (era il bug).
    manifest: true,
    // Vite 8 bundles production with Rolldown: `rollupOptions` → `rolldownOptions`, and the
    // OBJECT form of `manualChunks` no longer exists (the function form is deprecated).
    // That removal is a gift here, because the object form was silently wrong:
    //
    //   manualChunks: { three: ['three'] }   ← matched the BARE specifier only
    //
    // `three/webgpu` and `three/tsl` are separate entry points, so they never joined the chunk.
    // Measured on this kit: the chunk named "three" held the classic WebGL renderer (191 KB gzip,
    // zero WebGPU) while all of WebGPU+TSL stayed in the entry chunk (428 KB gzip) blocking first
    // paint — the exact opposite of what the old comment claimed. A path regex catches every
    // three entry point at once, which is what we wanted all along.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: 'three', test: /[\\/]node_modules[\\/]three[\\/]/ }],
        },
      },
    },
  },
})
