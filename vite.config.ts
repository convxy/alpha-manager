import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'recharts': ['recharts'],
          'firebase': ['firebase/app', 'firebase/firestore', 'firebase/auth'],
          'lucide': ['lucide-react'],
        }
      }
    },
    chunkSizeWarningLimit: 1200
  }
})
