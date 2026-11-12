import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        supermarket: fileURLToPath(new URL('./index.html', import.meta.url)),
        modelica: fileURLToPath(new URL('./drive-lab.html', import.meta.url)),
      },
    },
  },
})
