import { TanStackRouterVite } from '@tanstack/router-vite-plugin'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'
import glsl from 'vite-plugin-glsl'

/**
 * Dev-only endpoint that writes captures straight to disk instead of going through browser downloads.
 * Used when a sketch is opened with `?capture=disk` (see src/utils/capture_snapshot.ts). Files land in ./captures
 */
const captureToDisk = (): Plugin => ({
  name: 'capture-to-disk',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/__capture', (req, res) => {
      if (req.method !== 'POST') {
        res.statusCode = 405
        res.end()
        return
      }

      const url = new URL(req.url ?? '', 'http://localhost')
      const fileName = path.basename(url.searchParams.get('name') ?? '')
      if (!/^[\w.-]+\.(png|mp4|webm)$/.test(fileName)) {
        res.statusCode = 400
        res.end('Invalid file name')
        return
      }

      const dir = path.resolve(__dirname, 'captures')
      fs.mkdirSync(dir, { recursive: true })

      const chunks: Buffer[] = []
      req.on('data', (chunk) => chunks.push(chunk))
      req.on('end', () => {
        fs.writeFileSync(path.join(dir, fileName), Buffer.concat(chunks))
        res.statusCode = 201
        res.end(fileName)
      })
    })
  },
})

// https://vitejs.dev/config/
export default defineConfig({
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
    },
  },
  build: {
    target: 'esnext',
  },
  plugins: [react(), glsl(), TanStackRouterVite(), captureToDisk()],
  resolve: {
    alias: {
      '@/routes': path.resolve(__dirname, 'src/routes'),
      '@/components': path.resolve(__dirname, 'src/components'),
      '@/stores': path.resolve(__dirname, 'src/stores'),
      '@/utils': path.resolve(__dirname, 'src/utils'),
      '@/tsl': path.resolve(__dirname, 'src/tsl'),
      '@/sketches': path.resolve(__dirname, 'src/sketches'),
    },
  },
})
