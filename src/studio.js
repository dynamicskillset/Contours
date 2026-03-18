import { renderContour } from './contour.js'

const DEFAULT_AXES = [
  { label: 'Knowledge',     value: 65 },
  { label: 'Practice',      value: 80 },
  { label: 'Communication', value: 45 },
  { label: 'Collaboration', value: 70 },
  { label: 'Reflection',    value: 55 },
]

// Pre-built frameworks. Axis values are normalised 0–100.
const FRAMEWORKS = {
  digcomp: {
    name: 'DigComp 3.0',
    scale: 10,
    axes: [
      { label: 'Information & data', value: 50 },
      { label: 'Communication',      value: 50 },
      { label: 'Content creation',   value: 50 },
      { label: 'Safety',             value: 50 },
      { label: 'Problem solving',    value: 50 },
    ],
  },
}

let palette = 'nord'
let scale = 100   // 10 or 100

// ── Rendering ──────────────────────────────────────────────────────────────────

let outputEl, outputActionsEl  // cached at init

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
  outputEl.innerHTML = svg
  outputActionsEl.classList.toggle('hidden', !svg)
}

// ── Axis rows ──────────────────────────────────────────────────────────────────

function updateRemoveButtons() {
  const rows = document.querySelectorAll('.axis-row')
  const atMin = rows.length <= 3
  rows.forEach(row => {
    row.querySelector('.remove-axis').disabled = atMin
  })
}

// axis.value is always normalised 0–100; convert to current scale for display
function createAxisRow(axis) {
  const displayValue = Math.round((axis.value / 100) * scale)
  const row = document.createElement('div')
  row.className = 'axis-row'
  row.innerHTML = `
    <input class="axis-label" type="text" value="${escAttr(axis.label)}" maxlength="24" aria-label="${escAttr(axis.label)} — axis name">
    <div class="axis-controls">
      <input class="axis-value" type="range" min="0" max="${scale}" value="${displayValue}" aria-label="${escAttr(axis.label)} value, 0 to ${scale}" data-normalized="${axis.value}">
      <span class="axis-value-display" aria-hidden="true">${displayValue}</span>
    </div>
    <button class="remove-axis" type="button" aria-label="Remove ${escAttr(axis.label)} axis" title="Remove">×</button>
  `
  const labelInput = row.querySelector('.axis-label')
  const slider     = row.querySelector('.axis-value')
  const display    = row.querySelector('.axis-value-display')
  const removeBtn  = row.querySelector('.remove-axis')

  slider.addEventListener('input', () => {
    display.textContent = slider.value
    slider.dataset.normalized = Math.round((parseInt(slider.value, 10) / scale) * 100)
    render()
  })
  labelInput.addEventListener('input', () => {
    const name = labelInput.value.trim() || 'Axis'
    labelInput.setAttribute('aria-label', `${name} — axis name`)
    slider.setAttribute('aria-label', `${name} value, 0 to ${scale}`)
    removeBtn.setAttribute('aria-label', `Remove ${name} axis`)
    render()
  })
  removeBtn.addEventListener('click', () => {
    row.remove()
    render()
    updateRemoveButtons()
  })
  return row
}

function initAxesList() {
  const list = document.getElementById('axes-list')
  for (const axis of DEFAULT_AXES) list.appendChild(createAxisRow(axis))
}

function loadFramework(key) {
  const list    = document.getElementById('axes-list')
  const scaleEl = document.getElementById('scale-select')
  const axes    = key ? FRAMEWORKS[key].axes : DEFAULT_AXES
  const newScale = key ? FRAMEWORKS[key].scale : 100

  // Update scale variable and select
  scale = newScale
  scaleEl.value = String(newScale)

  // Replace axes
  list.innerHTML = ''
  for (const axis of axes) list.appendChild(createAxisRow(axis))
  updateRemoveButtons()
  render()
}

// ── Download ───────────────────────────────────────────────────────────────────

const anchor = document.getElementById('dl-anchor')

function triggerDownload(objectUrl, filename) {
  anchor.href = objectUrl
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 100)
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
    canvas.width = 608
    canvas.height = 608
    canvas.getContext('2d').drawImage(img, 0, 0)
    URL.revokeObjectURL(svgUrl)
    canvas.toBlob(blob => triggerDownload(URL.createObjectURL(blob), 'contour.png'), 'image/png')
  }
  img.src = svgUrl
}

// ── Init ───────────────────────────────────────────────────────────────────────

export function initStudio() {
  outputEl        = document.getElementById('output')
  outputActionsEl = document.getElementById('output-actions')

  initAxesList()
  updateRemoveButtons()

  document.getElementById('framework-select').addEventListener('change', e => {
    loadFramework(e.target.value || null)
  })

  document.getElementById('add-axis').addEventListener('click', () => {
    const list = document.getElementById('axes-list')
    list.appendChild(createAxisRow({ label: 'New axis', value: 50 }))
    render()
    updateRemoveButtons()
  })

  document.getElementById('palette-select').addEventListener('change', e => {
    palette = e.target.value
    render()
  })

  document.getElementById('scale-select').addEventListener('change', e => {
    const newScale = parseInt(e.target.value, 10)
    // Rescale all existing sliders to the new range, preserving normalised values
    document.querySelectorAll('.axis-row').forEach(row => {
      const slider     = row.querySelector('.axis-value')
      const display    = row.querySelector('.axis-value-display')
      const label      = row.querySelector('.axis-label').value.trim() || 'Axis'
      const normalized = parseInt(slider.dataset.normalized, 10)
      slider.max   = newScale
      const newVal = Math.round((normalized / 100) * newScale)
      slider.value = newVal
      display.textContent = newVal
      slider.setAttribute('aria-label', `${label} value, 0 to ${newScale}`)
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
