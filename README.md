# Contours

A topographic skills-profile visualiser and Open Badge v3 credential generator. Define competency axes and values; the tool renders layered contour lines — like an ordnance survey map — as a signed, portable badge you can keep, share, and reload.

**Live:** [dynamicskillset.com/contours](https://dynamicskillset.com/contours)

---

## What it does

Contours turns a set of competency dimensions into a visual topographic map. The further the contour lines reach from the centre, the higher the skill level. Crucially, it tracks how that map changes over time: each snapshot captures a moment, and the full history is baked into an exportable Open Badge.

The badge file is the database. No accounts, no server, no auto-save. Export your badge to save; reload it to continue.

## Features

- **Live contour map** — smooth closed paths at 20/40/60/80/100% of maximum, updated as you adjust sliders
- **Colour palettes** — six Nord-theme palettes (Blue, Red, Orange, Yellow, Green, Purple)
- **Value scales** — 0–100, 0–10, or 0–8
- **Framework presets** — DigComp 3.0 digital competence framework built in
- **Snapshot journal** — record how your profile changes over time with a description and optional evidence link; see what changed since your last snapshot
- **Timeline** — browse your full snapshot history; click any snapshot to preview it on the chart
- **Overlay compare mode** — layer historical snapshots as dashed silhouettes on the current chart
- **Open Badge v3 export** — signed SVG badge with the full credential and snapshot history embedded as CDATA
- **Credential JSON export** — raw JSON for verification at [verifierplus.org](https://verifierplus.org)
- **Round-trip import** — reload a previously exported badge to restore your full history
- **Ed25519 signing** — DataIntegrityProof / eddsa-rdfc-2022 via the Web Crypto API; no external crypto libraries

## How the credential works

Each export produces a signed OBv3 / Verifiable Credential. The credential includes:

- `achievement.criteria` — human-readable progression summary (e.g. "Knowledge 20%→75% (+55pp)")
- `achievement.image` — PNG thumbnail of the contour map
- `achievement.description` — optional free-text description you provide at export
- `evidence[]` — one entry per snapshot, each with the snapshot label, axes values, and optional supporting URL

The credential is signed with a fresh Ed25519 key pair derived as a `did:key`. The issuer URL you provide is preserved as `issuer.url`; `issuer.id` is set to the `did:key` so the signature validates correctly in standards-compliant verifiers.

## How it works

The rendering engine draws five concentric rings at 20%, 40%, 60%, 80%, and 100% of maximum. Each ring is a smooth closed Catmull-Rom path: where an axis value falls below a ring level, that ring pulls inward at that axis. The outermost ring shows the true data shape.

## Development

```bash
npm install
npm run dev       # development server (Vite)
npm run build     # production build
npm run preview   # preview production build locally
```

Built with vanilla JS and [Vite](https://vitejs.dev). No frameworks. `renderContour()` is a pure function; all DOM work is in `studio.js`.

## Deployment

Pushes to `main` trigger a GitHub Actions workflow that builds and rsyncs to the VPS.

## Licence

[AGPL-3.0](./LICENSE)

A [Dynamic Skillset](https://dynamicskillset.com) tool.
