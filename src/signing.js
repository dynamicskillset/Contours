/**
 * Ed25519 signing for Open Badges v3 credentials.
 * Uses the Web Crypto API — no external dependencies.
 * Cryptosuite: eddsa-jcs-2022 (JSON Canonicalization Scheme, RFC 8785).
 */

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

function base58btcEncode(bytes) {
  let leadingZeros = 0
  for (const b of bytes) {
    if (b !== 0) break
    leadingZeros++
  }
  let num = 0n
  for (const b of bytes) num = num * 256n + BigInt(b)
  let encoded = ''
  while (num > 0n) {
    encoded = BASE58_ALPHABET[Number(num % 58n)] + encoded
    num /= 58n
  }
  return '1'.repeat(leadingZeros) + encoded
}

// RFC 8785 JSON Canonicalization Scheme: sort object keys, deterministic output.
function canonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']'
  const keys = Object.keys(value).sort()
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalize(value[k])).join(',') + '}'
}

// Derive a did:key identifier from an Ed25519 CryptoKey.
// Format: did:key:z<base58btc(0xed01 || raw-public-key-bytes)>
async function publicKeyToDIDKey(publicKey) {
  const raw      = new Uint8Array(await crypto.subtle.exportKey('raw', publicKey))
  // Ed25519 multicodec prefix: 0xed 0x01
  const multikey = new Uint8Array([0xed, 0x01, ...raw])
  const fragment = 'z' + base58btcEncode(multikey)
  return { did: `did:key:${fragment}`, fragment }
}

// Returns true if Ed25519 key generation is available in this browser.
export async function isEd25519Supported() {
  try {
    await crypto.subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify'])
    return true
  } catch {
    return false
  }
}

export async function generateKeyPair() {
  return crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])
}

// Signs a credential using DataIntegrityProof / eddsa-jcs-2022.
// Returns a new credential object with a `proof` property appended.
export async function signCredential(credential, keyPair) {
  const { did, fragment } = await publicKeyToDIDKey(keyPair.publicKey)

  const proofHeader = {
    type:               'DataIntegrityProof',
    cryptosuite:        'eddsa-jcs-2022',
    created:            new Date().toISOString(),
    verificationMethod: `${did}#${fragment}`,
    proofPurpose:       'assertionMethod',
  }

  // Signing input: canonicalize(proofHeader) || canonicalize(credential)
  const enc       = new TextEncoder()
  const proofBytes = enc.encode(canonicalize(proofHeader))
  const credBytes  = enc.encode(canonicalize(credential))
  const toSign     = new Uint8Array(proofBytes.length + credBytes.length)
  toSign.set(proofBytes)
  toSign.set(credBytes, proofBytes.length)

  const sigBytes = new Uint8Array(
    await crypto.subtle.sign('Ed25519', keyPair.privateKey, toSign)
  )

  return {
    ...credential,
    proof: { ...proofHeader, proofValue: 'z' + base58btcEncode(sigBytes) },
  }
}
