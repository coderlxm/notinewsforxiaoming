import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import vueSetupExtend from 'vite-plugin-vue-setup-extend';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [vue(), vueSetupExtend()],
  server: {
    host: true,
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
    rolldownOptions: {
      input: {
        main: fileURLToPath(new URL('index.html', import.meta.url)),
        contribute: fileURLToPath(new URL('contribute.html', import.meta.url)),
      },
    },
  },
});
