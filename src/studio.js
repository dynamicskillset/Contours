import { renderContour } from './contour.js'
import { buildCredential } from './credential.js'
import { generateKeyPair, signCredential, isEd25519Supported } from './signing.js'
import { extractCredential, parseSnapshots } from './import.js'

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
    url: 'https://joint-research-centre.ec.europa.eu/projects-and-activities/education-and-training/digital-transformation-education/digital-competence-framework-digcomp/digcomp-30_en',
    scale: 8,
    axes: [
      { label: 'Information & data', value: 50 },
      { label: 'Communication',      value: 50 },
      { label: 'Content creation',   value: 50 },
      { label: 'Safety',             value: 50 },
      { label: 'Problem solving',    value: 50 },
    ],
  },
}

const MIN_AXES = 3
const MAX_AXES = 8

let palette = 'frost'
let scale   = 100   // 8, 10, or 100

// Snapshot history
let snapshots     = []    // { id, timestamp, description, url, axes, palette }
let previewIndex  = -1    // -1 = live; 0+ = viewing historical snapshot
let lastSavedAxes = null  // axes at last snapshot save; null = nothing saved yet

// ── Rendering ──────────────────────────────────────────────────────────────────

let outputEl, svgActionsEl

function readAxes() {
  return Array.from(document.querySelectorAll('.axis-row')).map(row => ({
    label: row.querySelector('.axis-label').value.trim() || 'Axis',
    value: Math.round((parseInt(row.querySelector('.axis-value').value, 10) / scale) * 100),
  }))
}

function render() {
  const axes = previewIndex >= 0 ? snapshots[previewIndex].axes    : readAxes()
  const pal  = previewIndex >= 0 ? snapshots[previewIndex].palette : palette
  const svg  = renderContour(axes, pal)
  outputEl.innerHTML = svg
  svgActionsEl.classList.toggle('hidden', !svg)
  updateBadgeTab()
  updateBadgeDot()
}

// ── Tab switching ──────────────────────────────────────────────────────────────

const TABS = ['dimensions', 'settings', 'badge']
let activeTab = 'dimensions'

function switchTab(name) {
  activeTab = name
  TABS.forEach(t => {
    document.getElementById(`tab-btn-${t}`).classList.toggle('is-active', t === name)
    document.getElementById(`tab-btn-${t}`).setAttribute('aria-selected', t === name)
    document.getElementById(`tab-${t}`).classList.toggle('hidden', t !== name)
  })
  if (name === 'badge') updateBadgeTab()
}

// ── Change detection ──────────────────────────────────────────────────────────

function axesEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false
  return a.every((ax, i) => ax.label === b[i].label && ax.value === b[i].value)
}

function computeDiff(previous, current) {
  if (!previous) return []
  return current.flatMap(axis => {
    const prev = previous.find(a => a.label === axis.label)
    if (!prev) return [{ label: axis.label, delta: null, isNew: true }]
    const delta = axis.value - prev.value
    if (delta === 0) return []
    return [{ label: axis.label, delta, isNew: false }]
  })
}

function hasDraft() {
  return lastSavedAxes !== null && !axesEqual(readAxes(), lastSavedAxes)
}

function updateBadgeDot() {
  const dot = document.getElementById('badge-tab-dot')
  dot.classList.toggle('hidden', !hasDraft())
}

function updateBadgeTab() {
  if (activeTab !== 'badge') return

  const intro        = document.getElementById('badge-intro')
  const draftBlock   = document.getElementById('draft-block')
  const noChanges    = document.getElementById('no-changes-block')

  if (snapshots.length === 0 && lastSavedAxes === null) {
    // First visit: show intro + "save first snapshot" form
    intro.classList.remove('hidden')
    draftBlock.classList.add('hidden')
    noChanges.classList.add('hidden')
    return
  }

  intro.classList.add('hidden')

  const draft = hasDraft()
  draftBlock.classList.toggle('hidden', !draft)
  noChanges.classList.toggle('hidden', draft)

  if (draft) {
    const diff    = computeDiff(lastSavedAxes, readAxes())
    const diffEl  = document.getElementById('draft-diff')
    diffEl.innerHTML = diff.map(d => {
      if (d.isNew) return `<li>${escAttr(d.label)} <em>(new)</em></li>`
      const sign = d.delta > 0 ? '+' : ''
      const cls  = d.delta > 0 ? 'positive' : 'negative'
      return `<li class="${cls}">${escAttr(d.label)} ${sign}${d.delta}</li>`
    }).join('')
  }
}

// ── Axis rows ──────────────────────────────────────────────────────────────────

function updateRemoveButtons() {
  const rows  = document.querySelectorAll('.axis-row')
  const atMin = rows.length <= MIN_AXES
  rows.forEach(row => {
    row.querySelector('.remove-axis').disabled = atMin
  })
}

function updateAddButton() {
  const atMax = document.querySelectorAll('.axis-row').length >= MAX_AXES
  document.getElementById('add-axis').disabled = atMax
}

function createAxisRow(axis) {
  const displayValue = Math.round((axis.value / 100) * scale)
  const row = document.createElement('div')
  row.className = 'axis-row'
  row.innerHTML = `
    <div class="axis-header">
      <input class="axis-label" type="text" value="${escAttr(axis.label)}" maxlength="24" aria-label="${escAttr(axis.label)} — dimension name">
      <span class="axis-value-display" aria-hidden="true">${displayValue}</span>
      <button class="remove-axis" type="button" aria-label="Remove ${escAttr(axis.label)} dimension" title="Remove">×</button>
    </div>
    <input class="axis-value" type="range" min="0" max="${scale}" value="${displayValue}" aria-label="${escAttr(axis.label)} value, 0 to ${scale}" data-normalized="${axis.value}">
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
    labelInput.setAttribute('aria-label', `${name} — dimension name`)
    slider.setAttribute('aria-label', `${name} value, 0 to ${scale}`)
    removeBtn.setAttribute('aria-label', `Remove ${name} axis`)
    render()
  })
  removeBtn.addEventListener('click', () => {
    row.remove()
    render()
    updateRemoveButtons()
    updateAddButton()
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
  const linkRow = document.getElementById('framework-link-row')
  const linkEl  = document.getElementById('framework-link')
  const fw      = key ? FRAMEWORKS[key] : null

  if (fw && fw.url) {
    linkEl.href = fw.url
    linkRow.classList.remove('hidden')
  } else {
    linkRow.classList.add('hidden')
  }
  const template = fw ? fw.axes : DEFAULT_AXES
  const newScale = fw ? fw.scale : 100

  scale = newScale
  scaleEl.value = String(newScale)

  list.innerHTML = ''
  for (const axis of template) {
    const value = fw ? Math.round(10 + Math.random() * 85) : axis.value
    list.appendChild(createAxisRow({ label: axis.label, value }))
  }
  updateRemoveButtons()
  updateAddButton()
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
  const src = renderContour(readAxes(), palette, true)
  if (!src) return
  triggerDownload(URL.createObjectURL(new Blob([src], { type: 'image/svg+xml' })), 'contour.svg')
}

function downloadPNG() {
  const src = renderContour(readAxes(), palette, true)
  if (!src) return
  const svgUrl = URL.createObjectURL(new Blob([src], { type: 'image/svg+xml' }))
  const img    = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width  = 2048
    canvas.height = 2048
    canvas.getContext('2d').drawImage(img, 0, 0, 2048, 2048)
    URL.revokeObjectURL(svgUrl)
    canvas.toBlob(blob => triggerDownload(URL.createObjectURL(blob), 'contour.png'), 'image/png')
  }
  img.src = svgUrl
}

// ── Snapshot history ───────────────────────────────────────────────────────────

function formatDate(ts) {
  const d    = new Date(ts)
  const diff = Date.now() - d
  if (diff < 60000)    return 'just now'
  if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function truncate(text, max = 60) {
  return text.length > max ? text.slice(0, max - 1) + '\u2026' : text
}

function safeUrl(url) {
  try {
    const u = new URL(url)
    return (u.protocol === 'https:' || u.protocol === 'http:') ? url : null
  } catch { return null }
}

function renderTimeline() {
  const el = document.getElementById('timeline')
  if (snapshots.length === 0) { el.innerHTML = ''; return }

  const items = snapshots.map((snap, i) => {
    const isCurrent = i === snapshots.length - 1
    const isActive  = i === previewIndex
    const safe      = snap.url ? safeUrl(snap.url) : null
    const linkHtml  = safe
      ? ` <a href="${escAttr(safe)}" target="_blank" rel="noopener" class="timeline-link" title="Supporting link">↗</a>`
      : ''
    return `<li class="timeline-entry${isActive ? ' is-active' : ''}${isCurrent ? ' is-current' : ''}">
      <button type="button" class="timeline-btn" data-index="${i}">
        <span class="timeline-date">${escAttr(formatDate(snap.timestamp))}</span>
        <span class="timeline-desc">${escAttr(truncate(snap.description))}</span>
      </button>${linkHtml}
    </li>`
  }).join('')

  const count = snapshots.length
  el.innerHTML =
    `<p class="timeline-heading">${count} snapshot${count === 1 ? '' : 's'}</p>` +
    `<ul class="timeline-list">${items}</ul>`

  el.querySelectorAll('.timeline-btn').forEach(btn => {
    btn.addEventListener('click', () => previewSnapshot(parseInt(btn.dataset.index, 10)))
  })
}

function previewSnapshot(index) {
  previewIndex = index
  const snap   = snapshots[index]
  document.getElementById('preview-label').textContent =
    `Snapshot ${index + 1} of ${snapshots.length} — ${formatDate(snap.timestamp)}`
  document.getElementById('preview-bar').classList.remove('hidden')
  render()
  renderTimeline()
}

function exitPreview() {
  previewIndex = -1
  document.getElementById('preview-bar').classList.add('hidden')
  render()
  renderTimeline()
}

function saveSnapshot(description, url) {
  if (!description) return false
  const axes = readAxes()
  snapshots.push({
    id:          `urn:uuid:${crypto.randomUUID()}`,
    timestamp:   new Date().toISOString(),
    description,
    url:         url || '',
    axes,
    palette,
  })
  lastSavedAxes = axes
  return true
}

function recordSnapshot() {
  const descEl  = document.getElementById('evidence-description')
  const errorEl = document.getElementById('record-error')
  const description = descEl.value.trim()

  if (!description) {
    errorEl.textContent = 'Describe what changed before saving.'
    errorEl.classList.remove('hidden')
    descEl.focus()
    return
  }
  errorEl.classList.add('hidden')

  saveSnapshot(description, document.getElementById('evidence-url').value.trim())
  descEl.value = ''
  document.getElementById('evidence-url').value = ''
  renderTimeline()
  updateBadgeTab()
  updateBadgeDot()
}

function recordFirstSnapshot() {
  const descEl  = document.getElementById('evidence-description-intro')
  const description = descEl.value.trim() || 'Initial profile'
  const url     = document.getElementById('evidence-url-intro').value.trim()

  saveSnapshot(description, url)
  descEl.value = ''
  document.getElementById('evidence-url-intro').value = ''
  renderTimeline()
  updateBadgeTab()
  updateBadgeDot()
}

// ── Export / Import ────────────────────────────────────────────────────────────

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'badge'
}

async function exportBadge() {
  const nameEl  = document.getElementById('badge-name')
  const errorEl = document.getElementById('export-badge-error')
  const name    = nameEl.value.trim()

  if (!name) {
    errorEl.textContent = 'Profile name is required to export as Open Badge.'
    errorEl.classList.remove('hidden')
    nameEl.focus()
    return
  }
  errorEl.classList.add('hidden')

  const btn = document.getElementById('export-badge-btn')
  btn.disabled = true
  btn.textContent = 'Signing…'

  try {
    const axes = snapshots.length > 0 ? snapshots[snapshots.length - 1].axes    : readAxes()
    const pal  = snapshots.length > 0 ? snapshots[snapshots.length - 1].palette : palette

    const issuerName = document.getElementById('badge-issuer-name').value.trim() || 'Dynamic Skillset'
    const issuerUrl  = document.getElementById('badge-issuer-url').value.trim()  || 'https://dynamicskillset.com'

    let credential = buildCredential({ name, axes, palette: pal, evidence: snapshots, issuerName, issuerUrl })

    if (await isEd25519Supported()) {
      const keyPair = await generateKeyPair()
      credential = await signCredential(credential, keyPair)
    } else {
      console.warn('Ed25519 not available — exporting unsigned credential.')
    }

    const svg  = renderContour(axes, pal, true, credential)
    if (!svg) return
    triggerDownload(URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })), `${slugify(name)}.svg`)
  } finally {
    btn.disabled = false
    btn.textContent = 'Export as Open Badge'
  }
}

async function importBadge(file) {
  const text       = await file.text()
  const credential = extractCredential(text)
  if (!credential) {
    // eslint-disable-next-line no-alert
    alert('No Open Badge credential found in this file.')
    return
  }
  const parsed = parseSnapshots(credential)

  document.getElementById('badge-name').value        = parsed.name
  document.getElementById('badge-issuer-name').value = parsed.issuerName || 'Dynamic Skillset'
  document.getElementById('badge-issuer-url').value  = parsed.issuerUrl  || 'https://dynamicskillset.com'

  snapshots    = parsed.snapshots
  previewIndex = -1

  if (snapshots.length > 0) {
    const latest = snapshots[snapshots.length - 1]
    lastSavedAxes = latest.axes
    palette = latest.palette
    document.getElementById('palette-select').value = latest.palette
    scale = 100
    document.getElementById('scale-select').value = '100'

    const list = document.getElementById('axes-list')
    list.innerHTML = ''
    for (const axis of latest.axes) list.appendChild(createAxisRow(axis))
    updateRemoveButtons()
    updateAddButton()
  }

  document.getElementById('preview-bar').classList.add('hidden')
  renderTimeline()
  render()

  // Switch to Badge tab to show the loaded history
  switchTab('badge')
}

// ── Init ───────────────────────────────────────────────────────────────────────

export function initStudio() {
  outputEl    = document.getElementById('output')
  svgActionsEl = document.getElementById('svg-actions')

  initAxesList()
  updateRemoveButtons()
  updateAddButton()

  // Tab switching
  TABS.forEach(t => {
    document.getElementById(`tab-btn-${t}`).addEventListener('click', () => switchTab(t))
  })

  // Dimensions tab controls
  document.getElementById('framework-select').addEventListener('change', e => {
    loadFramework(e.target.value || null)
  })

  document.getElementById('add-axis').addEventListener('click', () => {
    const list = document.getElementById('axes-list')
    list.appendChild(createAxisRow({ label: 'New dimension', value: 50 }))
    render()
    updateRemoveButtons()
    updateAddButton()
  })

  // Settings tab controls
  document.getElementById('palette-select').addEventListener('change', e => {
    palette = e.target.value
    render()
  })

  document.getElementById('scale-select').addEventListener('change', e => {
    const newScale = parseInt(e.target.value, 10)
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

  // SVG panel actions
  document.getElementById('download-svg-btn').addEventListener('click', downloadSVG)
  document.getElementById('download-png-btn').addEventListener('click', downloadPNG)
  document.getElementById('exit-preview-btn').addEventListener('click', exitPreview)

  // Badge tab actions
  document.getElementById('record-btn').addEventListener('click', recordSnapshot)
  document.getElementById('record-first-btn').addEventListener('click', recordFirstSnapshot)
  document.getElementById('export-badge-btn').addEventListener('click', exportBadge)

  document.querySelector('label[for="import-file"]').addEventListener('click', e => {
    e.preventDefault()
    document.getElementById('import-file').click()
  })

  document.getElementById('import-file').addEventListener('change', e => {
    const file = e.target.files[0]
    if (file) importBadge(file)
    e.target.value = ''
  })

  render()
}

function escAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}
