import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    // Incrementa el límite de advertencia a 1600 kB
    chunkSizeWarningLimit: 1600,
  },
});
