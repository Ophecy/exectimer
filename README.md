# Pyro Hangar Timer

A visual concept for a Star Citizen "Pyro Executive Hangar" cycle tracker: LED
phase matrix, open/close countdown, and per-zone contested-zone timers with a
zoomable map, styled as a sci-fi cockpit MFD.

The hangar cycle timers, admin sync/config panel, manual support timers, and
language switching are wired up and persist locally in the browser. Each
contested zone tab ships with a placeholder map (`public/maps/*.svg`) — swap
those files for real community map images to fill them in.

Design inspired by the community tool [exectimer.com](https://exectimer.com/)
(by TurboPolyp) — rebuilt from scratch here as a personal/educational project,
with its own name, branding, and codebase.

## Stack

Vite + TypeScript + Tailwind CSS v4, no framework.

## Develop

```sh
npm install
npm run dev
```

## Build

```sh
npm run build
npm run preview
```

## Deploy

Pushing to `main` builds the site and publishes it to GitHub Pages via
`.github/workflows/deploy.yml`. The Vite `base` in `vite.config.ts` is set to
`/pyro-hangar-timer/` to match the Pages URL — update it if the repo is
renamed.
