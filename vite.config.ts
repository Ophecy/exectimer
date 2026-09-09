import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/pyro-hangar-timer/',
  plugins: [tailwindcss()],
  // WSL2's /mnt/* (DrvFs) mounts don't emit inotify events, so Vite's default
  // watcher misses on-disk changes — poll instead so `npm run dev` reloads.
  server: { watch: { usePolling: true } },
})
