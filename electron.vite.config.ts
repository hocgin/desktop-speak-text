import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import * as process from 'node:process'

let isDev = process.env.NODE_ENV === 'development'

export default defineConfig({
  main: {
    esbuild: {
      drop: isDev ? [] : ['console', 'debugger']
    },
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    esbuild: {
      drop: isDev ? [] : ['console', 'debugger']
    },
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    esbuild: {
      drop: isDev ? [] : ['console', 'debugger']
    },
    resolve: {
      alias: {
        '@/renderer': resolve('src/renderer/src'),
        '@/lib': resolve('src/lib')
      }
    },
    plugins: [react(), tailwindcss()]
  }
})