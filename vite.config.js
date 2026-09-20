import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  publicDir: 'public',
  server: {
    port: 5173,
    strictPort: true,
    open: false,
  },
  build: {
    sourcemap: true,
    assetsInlineLimit: 0,
  },
});
