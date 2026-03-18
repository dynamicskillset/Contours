import { renderContour } from './contour.js'

const DEFAULT_AXES = [
  { label: 'Knowledge',     value: 65 },
  { label: 'Practice',      value: 80 },
  { label: 'Communication', value: 45 },
  { label: 'Collaboration', value: 70 },
  { label: 'Reflection',    value: 55 },
]

let palette = 'nord'
let scale = 100   // 10 or 100

// ── Rendering ──────────────────────────────────────────────────────────────────

function readAxes() {
  return Array.from(document.querySelectorAll('.axis-row')).map(row => ({
    label: row.querySelector('.axis-label').value.trim() || 'Axis',
    // Normalise to 0–100 regardless of current scale
    value: Math.round((parseInt(row.querySelector('.axis-value').value, 10) / scale) * 100),
  }))
}

function render() {
  const axes = readAxes()
  const svg = renderContour(axes, palette)
  document.getElementById('output').innerHTML = svg
  document.getElementById('output-actions').classList.toggle('hidden', !svg)
}

// ── Axis rows ──────────────────────────────────────────────────────────────────

// axis.value is always normalised 0–100; convert to current scale for display
function createAxisRow(axis) {
  const displayValue = Math.round((axis.value / 100) * scale)
  const row = document.createElement('div')
  row.className = 'axis-row'
  row.innerHTML = `
    <input class="axis-label" type="text" value="${escAttr(axis.label)}" maxlength="24" aria-label="Axis label">
    <div class="axis-controls">
      <input class="axis-value" type="range" min="0" max="${scale}" value="${displayValue}" aria-label="Value 0 to ${scale}" data-normalized="${axis.value}">
      <span class="axis-value-display">${displayValue}</span>
    </div>
    <button class="remove-axis" type="button" aria-label="Remove axis" title="Remove">×</button>
  `
  const slider  = row.querySelector('.axis-value')
  const display = row.querySelector('.axis-value-display')
  slider.addEventListener('input', () => {
    display.textContent = slider.value
    slider.dataset.normalized = Math.round((parseInt(slider.value, 10) / scale) * 100)
    render()
  })
  row.querySelector('.axis-label').addEventListener('input', render)
  row.querySelector('.remove-axis').addEventListener('click', () => {
    if (document.querySelectorAll('.axis-row').length <= 3) return
    row.remove()
    render()
  })
  return row
}

function initAxesList() {
  const list = document.getElementById('axes-list')
  for (const axis of DEFAULT_AXES) list.appendChild(createAxisRow(axis))
}

// ── Download ───────────────────────────────────────────────────────────────────

const anchor = document.getElementById('dl-anchor')

function triggerDownload(objectUrl, filename) {
  anchor.href = objectUrl
  anchor.download = filename
  anchor.click()
}

function downloadSVG() {
  const el = document.querySelector('#output svg')
  if (!el) return
  const src = new XMLSerializer().serializeToString(el)
  const blob = new Blob([src], { type: 'image/svg+xml' })
  triggerDownload(URL.createObjectURL(blob), 'contour.svg')
}

function downloadPNG() {
  const el = document.querySelector('#output svg')
  if (!el) return
  const src = new XMLSerializer().serializeToString(el)
  const svgUrl = URL.createObjectURL(new Blob([src], { type: 'image/svg+xml' }))
  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 512
    canvas.getContext('2d').drawImage(img, 0, 0)
    URL.revokeObjectURL(svgUrl)
    canvas.toBlob(blob => triggerDownload(URL.createObjectURL(blob), 'contour.png'), 'image/png')
  }
  img.src = svgUrl
}

// ── Init ───────────────────────────────────────────────────────────────────────

export function initStudio() {
  initAxesList()

  document.getElementById('add-axis').addEventListener('click', () => {
    const list = document.getElementById('axes-list')
    list.appendChild(createAxisRow({ label: 'New axis', value: 50 }))
    render()
  })

  document.getElementById('palette-select').addEventListener('change', e => {
    palette = e.target.value
    render()
  })

  document.getElementById('scale-select').addEventListener('change', e => {
    const newScale = parseInt(e.target.value, 10)
    // Rescale all existing sliders to the new range, preserving normalised values
    document.querySelectorAll('.axis-row').forEach(row => {
      const slider  = row.querySelector('.axis-value')
      const display = row.querySelector('.axis-value-display')
      const normalized = parseInt(slider.dataset.normalized, 10)
      slider.max = newScale
      const newVal = Math.round((normalized / 100) * newScale)
      slider.value = newVal
      display.textContent = newVal
    })
    scale = newScale
    render()
  })

  document.getElementById('download-svg-btn').addEventListener('click', downloadSVG)
  document.getElementById('download-png-btn').addEventListener('click', downloadPNG)

  render()
}

function escAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}
