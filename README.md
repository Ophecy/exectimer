# Pyro Hangar Timer

A visual concept for a Star Citizen "Pyro Executive Hangar" cycle tracker: LED
phase matrix, open/close countdown, and per-zone contested-zone timers with
zoomable sector plans, styled as a Pyro ASOP terminal — one continuous amber
screen inside a dark chassis, behind a pane of dirty glass.

The hangar cycle timers, admin sync/config panel, manual support timers, and
language switching are wired up and persist locally in the browser.

## Sector plans

`public/maps/*.svg` holds one schematic plate per contested zone (Checkmate,
Orbituary, Ruin Station), drawn as ink line work on the terminal's amber field:
objectives, accesses, extract/freight elevators, card printers, fuse doors and
spawners, plus the keyed, timed and elevator-only routes between them. The
plates are transparent — the amber comes from the page, so the preview modal
paints its own ground.

They are redrawn from the community contested-zone maps by
[u/Zane_DragonBorn](https://www.reddit.com/user/Zane_DragonBorn/), credited on
each plate. Clicking a card opens the plate full size: scroll to zoom, drag to
pan, click outside or press Escape to close.

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
`.github/workflows/deploy.yml` (Pages source must be set to *GitHub Actions*).

A project site is served from `https://<user>.github.io/<repo>/`, so the Vite
`base` has to match the repository name — otherwise every asset 404s and the
page renders as bare HTML with no CSS or timers. `vite.config.ts` reads it back
from `GITHUB_REPOSITORY` in CI, so a rename can't break the deploy; outside CI
the base stays `/` for `npm run dev`. Anything under `public/` is copied
verbatim and never rewritten, so reference those files relatively (`./`).

To reproduce a Pages build locally:

```sh
GITHUB_REPOSITORY=owner/repo npm run build && npm run preview
```
