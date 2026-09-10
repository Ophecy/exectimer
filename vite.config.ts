import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages serves a project site from /<repo>/, so `base` has to match the
// repository name or every built asset 404s and only the bare HTML renders.
// Reading it back from the Actions env means renaming the repo can't silently
// break the deploy again; outside CI it stays at '/' for dev and preview.
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1]

export default defineConfig({
  base: repo ? `/${repo}/` : '/',
  plugins: [tailwindcss()],
  // WSL2's /mnt/* (DrvFs) mounts don't emit inotify events, so Vite's default
  // watcher misses on-disk changes — poll instead so `npm run dev` reloads.
  server: { watch: { usePolling: true } },
})
