import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// The current release, read from the latest tag rather than a hand-bumped file:
// publishing v1.0 is all it takes for the next build to say v1.0. The CI
// checkout needs its full history for this (fetch-depth: 0).
function resolveVersion(): string {
  try {
    return execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim()
  } catch {
    return 'dev'
  }
}

// GitHub Pages serves a project site from /<repo>/, so `base` has to match the
// repository name or every built asset 404s and only the bare HTML renders.
// Reading it back from the Actions env means renaming the repo can't silently
// break the deploy again; outside CI it stays at '/' for dev and preview.
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1]

export default defineConfig({
  base: repo ? `/${repo}/` : '/',
  define: { 'import.meta.env.VITE_APP_VERSION': JSON.stringify(resolveVersion()) },
  plugins: [tailwindcss()],
  // WSL2's /mnt/* (DrvFs) mounts don't emit inotify events, so Vite's default
  // watcher misses on-disk changes — poll instead so `npm run dev` reloads.
  server: { watch: { usePolling: true } },
})
