import { defineConfig } from 'vite';

export default defineConfig({
    base: './',
    server: { port: 5180, strictPort: true },
    build: {
        target: 'es2022',
        chunkSizeWarningLimit: 1200
    }
});
