// Pure SVG rendering engine — no DOM side-effects.
// Called from studio.js with axes data and a palette name.

const SVG_SIZE = 512
const PAD = 48          // extra space around the chart so labels don't clip
const CX = 256
const CY = 256
const MAX_R = 185       // leave room for axis labels at the edge
const LEVELS = [20, 40, 60, 80, 100]

// Convert polar coords to cartesian. Angle 0 = top (12 o'clock).
function polar(r, angleDeg) {
  const rad = (angleDeg - 90) * (Math.PI / 180)
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) }
}

function fmt(n) { return n.toFixed(2) }

// Catmull-Rom smooth closed path through an array of {x,y} points.
function smoothClosedPath(pts) {
  const n = pts.length
  if (n < 3) return ''
  const cmds = [`M ${fmt(pts[0].x)} ${fmt(pts[0].y)}`]
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % n]
    const p3 = pts[(i + 2) % n]
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    cmds.push(`C ${fmt(cp1x)} ${fmt(cp1y)} ${fmt(cp2x)} ${fmt(cp2y)} ${fmt(p2.x)} ${fmt(p2.y)}`)
  }
  cmds.push('Z')
  return cmds.join(' ')
}

// Escape XML special characters for safe embedding in SVG text/attributes.
function escXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Split a multi-word label into two lines at the most balanced word boundary.
// Single-word labels are returned as-is in a one-element array.
function splitLabel(text) {
  const words = text.split(' ')
  if (words.length <= 1) return [text]
  let bestSplit = 1, bestDiff = Infinity
  for (let i = 1; i < words.length; i++) {
    const diff = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length)
    if (diff < bestDiff) { bestDiff = diff; bestSplit = i }
  }
  return [words.slice(0, bestSplit).join(' '), words.slice(bestSplit).join(' ')]
}

/**
 * Render a contour SVG from axes data.
 *
 * @param {Array<{label: string, value: number}>} axes  — min 3, max ~8
 * @param {string} palette  — key of PALETTES
 * @returns {string}  SVG markup
 */
export function renderContour(axes, palette = 'nord') {
  if (!axes || axes.length < 3) return ''

  const n = axes.length
  const angleStep = 360 / n
  const colors = PALETTES[palette] || PALETTES.nord

  const titleText = 'Skills profile: ' + axes.map(a => `${a.label} ${a.value}%`).join(', ')

  const parts = []
  const VB = SVG_SIZE + PAD * 2   // 608
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-PAD} ${-PAD} ${VB} ${VB}" role="img" aria-labelledby="contour-title">`)
  parts.push(`<title id="contour-title">${escXml(titleText)}</title>`)
  parts.push(`<rect x="${-PAD}" y="${-PAD}" width="${VB}" height="${VB}" fill="${colors.bg}"/>`)

  // Guide circles at each contour level
  for (const level of LEVELS) {
    const r = (level / 100) * MAX_R
    parts.push(`<circle cx="${CX}" cy="${CY}" r="${fmt(r)}" fill="none" stroke="${colors.guide}" stroke-width="0.75" stroke-dasharray="3 6" opacity="0.45"/>`)
  }

  // Axis spokes from centre to MAX_R
  for (let i = 0; i < n; i++) {
    const end = polar(MAX_R, i * angleStep)
    parts.push(`<line x1="${CX}" y1="${CY}" x2="${fmt(end.x)}" y2="${fmt(end.y)}" stroke="${colors.guide}" stroke-width="0.75" opacity="0.45"/>`)
  }

  // Centre dot
  parts.push(`<circle cx="${CX}" cy="${CY}" r="2.5" fill="${colors.guide}" opacity="0.4"/>`)

  // Compute each ring's smooth path.
  // At level L, axis with value V contributes a point at min(V, L) % of MAX_R.
  // This means axes that don't reach a ring level dip inward at that ring — the
  // rings only fan out to an axis as far as that axis's value allows.
  const ringPaths = LEVELS.map(level =>
    smoothClosedPath(
      axes.map((axis, i) => {
        const v = Math.min(axis.value, level)
        return polar((v / 100) * MAX_R, i * angleStep)
      })
    )
  )

  // Light fill on the outermost ring (actual data shape)
  parts.push(`<path d="${ringPaths[ringPaths.length - 1]}" fill="${colors.fill}" fill-opacity="0.10"/>`)

  // Stroke all rings: inner rings thinner and more transparent, outer heavier and opaque
  for (let li = 0; li < LEVELS.length; li++) {
    const t = li / (LEVELS.length - 1)
    const strokeOpacity = (0.25 + t * 0.75).toFixed(2)
    const strokeWidth   = (0.7 + t * 1.1).toFixed(2)
    parts.push(`<path d="${ringPaths[li]}" fill="none" stroke="${colors.stroke}" stroke-width="${strokeWidth}" stroke-opacity="${strokeOpacity}" stroke-linecap="round" stroke-linejoin="round"/>`)
  }

  // Axis labels — multi-word labels split across two lines to reduce horizontal overflow
  const LABEL_R = MAX_R + 24
  for (let i = 0; i < n; i++) {
    const angleDeg = i * angleStep
    const pt = polar(LABEL_R, angleDeg)
    const rad = (angleDeg - 90) * (Math.PI / 180)
    const cosA = Math.cos(rad)
    const sinA = Math.sin(rad)
    const anchor = cosA > 0.15 ? 'start' : cosA < -0.15 ? 'end' : 'middle'
    // dy in em, used to vertically centre the label around the anchor point
    const dyEm = sinA < -0.7 ? -0.3 : sinA > 0.7 ? 1.0 : 0.35
    const textBase = `text-anchor="${anchor}" font-family="system-ui, sans-serif" font-size="14" font-weight="600" fill="${colors.label}"`
    const lines = splitLabel(axes[i].label)
    if (lines.length === 1) {
      parts.push(`<text x="${fmt(pt.x)}" y="${fmt(pt.y)}" dy="${dyEm}em" ${textBase}>${escXml(lines[0])}</text>`)
    } else {
      // Shift first line up 0.6em so the pair is centred on the anchor point
      const dy1 = (dyEm - 0.6).toFixed(2) + 'em'
      parts.push(
        `<text x="${fmt(pt.x)}" y="${fmt(pt.y)}" ${textBase}>` +
        `<tspan x="${fmt(pt.x)}" dy="${dy1}">${escXml(lines[0])}</tspan>` +
        `<tspan x="${fmt(pt.x)}" dy="1.2em">${escXml(lines[1])}</tspan>` +
        `</text>`
      )
    }
  }

  parts.push('</svg>')
  return parts.join('\n')
}

export const PALETTES = {
  nord:   { bg: '#F9FAFC', guide: '#4C566A', stroke: '#5E81AC', fill: '#5E81AC', label: '#2E3440' },
  ocean:  { bg: '#F9FAFC', guide: '#2C5F7A', stroke: '#29A7C5', fill: '#29A7C5', label: '#0D2E3A' },
  forest: { bg: '#F9FAFC', guide: '#3D5C3D', stroke: '#5A9E5A', fill: '#5A9E5A', label: '#1B2E1B' },
  wao:    { bg: '#F9FAFC', guide: '#2F495A', stroke: '#00C399', fill: '#00C399', label: '#2F495A' },
}
