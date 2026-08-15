import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => {
  if (mode === 'server') {
    return {
      build: {
        ssr: 'src/server.ts',
        outDir: 'dist/server',
        emptyOutDir: false,
        rollupOptions: {
          output: {
            entryFileNames: 'server.js',
          },
        },
      },
    }
  }

  return {
    plugins: [vue()],
    root: 'src/client',
    build: {
      outDir: '../../dist/client',
      emptyOutDir: false,
    },
    server: {
      proxy: {
        '/api': {
          target: 'https://lu.xmcloud.buzz',
          changeOrigin: true,
        },
      },
    },
  }
})
