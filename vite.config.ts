import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // three/webgpu + three/tsl are large; isolate all of three into its own chunk so the
        // app shell can paint before the renderer bundle is parsed.
        manualChunks(id) {
          if (id.includes('/node_modules/three/')) return 'three'
          return undefined
        },
      },
    },
    // the WebGPU build is sizeable; raise the warning ceiling so the build is not noisy.
    chunkSizeWarningLimit: 1500,
  },
})
