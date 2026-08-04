import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 5173 is Vite's default and collides with any other Vite project running
    // at the same time (e.g. the course site). 5180 keeps this app on its own
    // port. Override with PORT=xxxx if 5180 is ever taken too.
    port: process.env.PORT ? Number(process.env.PORT) : 5180
  }
})
