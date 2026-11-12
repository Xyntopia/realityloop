import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        catalog: fileURLToPath(new URL('./index.html', import.meta.url)),
        supermarket: fileURLToPath(new URL('./examples/supermarket.html', import.meta.url)),
        traction: fileURLToPath(new URL('./drive-lab.html', import.meta.url)),
      },
    },
  },
})
