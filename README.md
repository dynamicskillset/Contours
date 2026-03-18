# Contours

A topographic skills-profile visualiser. Define competency axes and values; the tool renders layered, smooth contour lines — like an ordnance survey map — as an SVG or PNG you can attach to an Open Badge.

**Live:** [dynamicskillset.com/contours](https://dynamicskillset.com/contours)

---

## How it works

1. Choose a colour palette and value scale (0–10 or 0–100)
2. Name your axes and set a value for each (minimum three)
3. The contour map updates live
4. Download as SVG or PNG

The rendering engine draws five concentric rings at 20%, 40%, 60%, 80%, and 100% of maximum. Each ring is a smooth closed path: where an axis value falls below a ring level, that ring dips inward at that axis. The outermost ring shows the true data shape.

## Development

```bash
npm install
npm run dev       # development server
npm run build     # production build
npm run preview   # preview production build locally
```

Built with vanilla JS and [Vite](https://vitejs.dev). No frameworks.

## Licence

[Mozilla Public License, v2.0](https://www.mozilla.org/en-US/MPL/2.0/)

A [Dynamic Skillset](https://dynamicskillset.com) tool.
