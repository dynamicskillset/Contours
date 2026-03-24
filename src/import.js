/**
 * Extract and parse an OBv3 credential from a baked SVG string.
 * Pure functions — no DOM side-effects.
 */

// Parse the [contours:v1:<palette>:<Axis>=<val>,...] encoding from a narrative string.
function parseContoursTag(narrative) {
  if (!narrative) return null
  const match = narrative.match(/\[contours:v1:([^:]+):([^\]]+)\]/)
  if (!match) return null
  const palette = match[1]
  const axes = match[2].split(',').map(part => {
    const eq = part.indexOf('=')
    return { label: part.slice(0, eq), value: parseInt(part.slice(eq + 1), 10) }
  }).filter(a => a.label && !isNaN(a.value))
  return axes.length >= 3 ? { palette, axes } : null
}

// Extract the OBv3 credential JSON from a baked SVG string.
// Returns the parsed credential object, or null if not found/parseable.
export function extractCredential(svgString) {
  try {
    const match = svgString.match(
      /<openbadges:credential[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/openbadges:credential>/
    )
    if (!match) return null
    return JSON.parse(match[1].trim())
  } catch {
    return null
  }
}

// Reconstruct snapshot history from a parsed OBv3 credential.
// Returns { name, issuerName, issuerUrl, description, snapshots }.
export function parseSnapshots(credential) {
  const name        = credential.name || ''
  const issuerName  = credential.issuer?.name || ''
  const issuerUrl   = credential.issuer?.id   || ''
  const description = credential.credentialSubject?.achievement?.description || ''

  const rawEvidence = credential.credentialSubject?.evidence || []
  const snapshots   = rawEvidence.flatMap(ev => {
    const parsed = parseContoursTag(ev.narrative)
    if (!parsed) return []
    return [{
      id:          ev.id || `urn:uuid:${crypto.randomUUID()}`,
      timestamp:   ev.created || new Date().toISOString(),
      description: ev.name || '',
      url:         ev.description || '',
      axes:        parsed.axes,
      palette:     parsed.palette,
    }]
  })

  return { name, issuerName, issuerUrl, description, snapshots }
}
