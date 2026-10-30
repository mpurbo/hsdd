import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  server: {
    // auth-api@v1 and profile-api@v2 development address; 127.0.0.1, not localhost.
    proxy: { '/api': { target: 'http://127.0.0.1:3000' } },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
