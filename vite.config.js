import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // relative paths, so the build works from any folder (GitHub Pages serves it under /<repo>/)
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
  server: { host: '127.0.0.1' },
});
