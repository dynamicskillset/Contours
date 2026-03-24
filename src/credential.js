/**
 * Build an Open Badges v3 / Verifiable Credential JSON object.
 * Pure function — no DOM side-effects.
 *
 * @param {object} opts
 * @param {string} opts.name               — profile name
 * @param {string} [opts.description]
 * @param {Array<{label,value}>} opts.axes — current/latest axes (0–100)
 * @param {string} opts.palette
 * @param {Array<snapshot>} [opts.evidence] — full snapshot history
 * @param {string} opts.issuerName
 * @param {string} opts.issuerUrl
 * @param {string} [opts.issuedAt]
 * @param {string} [opts.image]     — data URI for the badge thumbnail image
 */
export function buildCredential({
  name,
  description = '',
  axes,
  palette,
  evidence = [],
  issuerName,
  issuerUrl,
  issuedAt = new Date().toISOString(),
  image = null,
}) {
  const credId        = `urn:uuid:${crypto.randomUUID()}`
  const subjectId     = `urn:uuid:${crypto.randomUUID()}`
  const achievementId = `urn:uuid:${crypto.randomUUID()}`

  const axesText  = axes.map(a => `${a.label} ${a.value}%`).join(', ')
  const snapCount = evidence.length

  let narrative
  if (snapCount > 1) {
    const first = evidence[0]
    const progressText = axes.map(a => {
      const prev = first.axes.find(fa => fa.label === a.label)
      if (!prev) return `${a.label} ${a.value}%`
      const delta = a.value - prev.value
      return `${a.label} ${prev.value}%\u2192${a.value}% (${delta >= 0 ? '+' : ''}${delta}pp)`
    }).join(', ')
    narrative = `Topographic skills profile with ${snapCount} snapshots. Progress: ${progressText}.`
  } else if (snapCount === 1) {
    narrative = `Topographic skills profile recorded at one point in time. Current: ${axesText}.`
  } else {
    narrative = `Topographic skills profile: ${axesText}.`
  }

  const achievement = {
    id:       achievementId,
    type:     ['Achievement'],
    name,
    criteria: { narrative },
    ...(description  ? { description }                          : {}),
    ...(image        ? { image: { id: image, type: ['Image'] } } : {}),
  }

  const credential = {
    '@context': [
      'https://www.w3.org/ns/credentials/v2',
      'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json',
    ],
    id:   credId,
    type: ['VerifiableCredential', 'OpenBadgeCredential'],
    issuer: {
      id:   issuerUrl,
      type: ['Profile'],
      name: issuerName,
    },
    validFrom: issuedAt,
    name,
    credentialSubject: {
      id:   subjectId,
      type: ['AchievementSubject'],
      achievement,
    },
  }

  if (evidence.length > 0) {
    // evidence is a top-level credential property per the OBv3 / VC Data Model spec
    credential.evidence = evidence.map(snap => {
      const tag      = `[contours:v1:${snap.palette}:${snap.axes.map(a => `${a.label}=${a.value}`).join(',')}]`
      const snapAxes = snap.axes.map(a => `${a.label} ${a.value}%`).join(', ')
      return {
        id:          snap.id,
        type:        ['Evidence'],
        name:        snap.description,
        description: snapAxes,
        narrative:   tag,
        ...(snap.url ? { url: snap.url } : {}),
      }
    })
  }

  return credential
}
