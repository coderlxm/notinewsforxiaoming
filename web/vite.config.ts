import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [vue()],
  server: {
    proxy: {
      '/api': {
        target: 'https://feeds.xmcloud.buzz',
        changeOrigin: true,
      },
      '/media': {
        target: 'https://feeds.xmcloud.buzz',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
