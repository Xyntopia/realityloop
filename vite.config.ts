import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  // pcl.js v1.16 uses JavaScript constructor .name to look up WASM classes
  // (e.g. PointCloudPointXYZ). Minification without keepNames renames PointXYZ
  // and crashes the deployed supermarket on its first ICP registration.
  esbuild: {keepNames: true},
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
