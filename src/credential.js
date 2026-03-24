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
}) {
  const credId        = `urn:uuid:${crypto.randomUUID()}`
  const achievementId = `urn:uuid:${crypto.randomUUID()}`

  const axesText    = axes.map(a => `${a.label} ${a.value}%`).join(', ')
  const contoursTag = `[contours:v1:${palette}:${axes.map(a => `${a.label}=${a.value}`).join(',')}]`
  const narrative   = `Skills profile: ${axesText}\n${contoursTag}`

  const credential = {
    '@context': [
      'https://www.w3.org/ns/credentials/v2',
      'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json',
    ],
    id:   credId,
    type: ['VerifiableCredential', 'OpenBadgeCredential'],
    issuer: {
      id:   issuerUrl,
      type: 'Profile',
      name: issuerName,
    },
    validFrom: issuedAt,
    name,
    credentialSubject: {
      type: 'AchievementSubject',
      achievement: {
        id:          achievementId,
        type:        'Achievement',
        name,
        description,
        criteria:    { narrative },
      },
    },
  }

  if (evidence.length > 0) {
    credential.credentialSubject.evidence = evidence.map(snap => {
      const tag = `[contours:v1:${snap.palette}:${snap.axes.map(a => `${a.label}=${a.value}`).join(',')}]`
      return {
        id:       snap.id,
        type:     ['Evidence'],
        name:     snap.description,
        ...(snap.url ? { description: snap.url } : {}),
        narrative: tag,
        created:  snap.timestamp,
      }
    })
  }

  return credential
}
