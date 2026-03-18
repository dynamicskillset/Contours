# Project: Contours

A topographic skills-profile visualiser. Users define competency axes and values (0–100); the tool renders layered, smooth contour lines — like an ordnance survey map — as an SVG/PNG they can attach to an Open Badge.

Forked from [badge-studio](https://github.com/dynamicskillset/badge-studio). Shares Nord theme and deployment infrastructure; has its own rendering pipeline.

## Architecture

- `index.html` — entry point, form structure, off-screen download anchor
- `src/main.js` — imports CSS, calls `initStudio()`
- `src/studio.js` — all UI logic: axis rows, palette, download, event wiring
- `src/contour.js` — pure SVG rendering engine (no DOM); exports `renderContour(axes, palette)`
- `src/styles/main.css` — Nord light theme, shared tokens, axis-row layout
- `public/` — static assets (OG image etc. when added)

## Commands

- `npm run dev` — start development server
- `npm run build` — production build (base: `/contours/`)
- `npm run preview` — preview production build locally

## Standards

- Vanilla JS + Vite — no frameworks
- `renderContour()` must remain a pure function (no DOM side-effects); all DOM work in `studio.js`
- SVG export uses `XMLSerializer`; PNG export renders SVG to canvas via an `<img>` element
- System fonts only in exported SVG (`system-ui, sans-serif`) — web fonts in the UI only, to avoid canvas CORS tainting
- British English in all copy

## Copy Rules

Same as Badge Studio:
- No em dashes — use commas, colons, semicolons, or full stops
- Avoid: landscape, ensure, crucial, robust, enhance, transform, empower, seamless, etc.

## Verification

- Run `npm run build` after structural changes to confirm nothing breaks
- Test axis add/remove, palette switching, SVG and PNG download in browser after changes
- Minimum 3 axes required for render — verify edge case is handled gracefully

## Working Rules

- Always check for existing patterns before creating new ones
- Prefer small, incremental changes over big rewrites
- If a task will take more than ~50 lines of changes, use plan mode first
- Don't add dependencies without asking
- Don't refactor code that wasn't part of the task

## Rendering notes

The contour algorithm (`src/contour.js`):
- Axes are evenly spaced around a circle (starting from the top, -90°)
- Five rings at levels 20/40/60/80/100%
- At each level L, an axis with value V contributes a point at `min(V, L)/100 * MAX_R` radius
- Rings are drawn as smooth closed Catmull-Rom bezier paths
- Outermost ring (actual data shape) gets a light fill tint; all rings get stroked with increasing weight/opacity outward
- Guide circles and axis spokes are drawn in a muted colour at 50% opacity

## Deployment

- VPS: `root@80.78.23.57`, path `/opt/ghost/sites/dynamicskillset.com/contours/`
- CI/CD: `.github/workflows/deploy.yml` — push to `master` triggers build + rsync
- Secrets needed: `VPS_HOST`, `VPS_SSH_KEY` (same as badge-studio, shared at org level)
- Live at: dynamicskillset.com/contours (once deployed)

## State & Progress

> Updated: 2026-03-18
> Current focus: Initial scaffold — core rendering + UI complete, not yet deployed
> Status: Local only, no GitHub repo yet

## Known Issues

- None yet — new project

## Lessons Learned

Things Claude has got wrong on this project — don't repeat these:

- (none yet)
