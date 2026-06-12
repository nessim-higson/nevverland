import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // relative base so frozen builds work from any path (…/_versions/…/vN/)
  base: './',
  server: { port: 4189 },
})
