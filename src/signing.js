/**
 * Ed25519 signing for Open Badges v3 credentials.
 * Cryptosuite: eddsa-rdfc-2022 (RDF Dataset Canonicalization, URDNA2015/RDFC-1.0).
 * Contexts are bundled locally — no network requests during signing.
 */

import jsonld from 'jsonld'
import credV2Context from './contexts/credentials-v2.json'
import ob3Context    from './contexts/ob-v3p0.json'

// ── Bundled context loader ──────────────────────────────────────────────────
// credentials-v2 already defines DataIntegrityProof and all proof terms via
// scoped contexts — data-integrity-v1 is not needed and would conflict.

const BUNDLED_CONTEXTS = {
  'https://www.w3.org/ns/credentials/v2':                       credV2Context,
  'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json': ob3Context,
}

function localDocumentLoader(url) {
  const doc = BUNDLED_CONTEXTS[url]
  if (doc) return { contextUrl: null, document: doc, documentUrl: url }
  throw new Error(`Context not bundled locally: ${url}`)
}

// ── Base58btc ──────────────────────────────────────────────────────────────

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

// ── did:key derivation ─────────────────────────────────────────────────────

// Derive a did:key identifier from an Ed25519 public CryptoKey.
// Format: did:key:z<base58btc(varint(0xed) + raw-public-key-bytes)>
async function publicKeyToDIDKey(publicKey) {
  const raw      = new Uint8Array(await crypto.subtle.exportKey('raw', publicKey))
  const multikey = new Uint8Array([0xed, 0x01, ...raw])   // varint(0xed) = 0xed 0x01
  const fragment = 'z' + base58btcEncode(multikey)
  return { did: `did:key:${fragment}`, fragment }
}

// ── RDF canonicalization ───────────────────────────────────────────────────

async function rdfc10(doc) {
  const nquads = await jsonld.canonize(doc, {
    algorithm: 'RDFC-1.0',
    format: 'application/n-quads',
    safe: false,                     // permit unknown terms (silently ignored in RDF expansion)
    documentLoader: localDocumentLoader,
  })
  return nquads
}

// ── Public API ─────────────────────────────────────────────────────────────

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

// Signs a credential using DataIntegrityProof / eddsa-rdfc-2022.
// Returns a new credential object with proof appended.
export async function signCredential(credential, keyPair) {
  const { did, fragment } = await publicKeyToDIDKey(keyPair.publicKey)

  // Proof config uses the same @context as the document (per eddsa-rdfc-2022 spec)
  const proofConfig = {
    '@context':         credential['@context'],
    type:               'DataIntegrityProof',
    cryptosuite:        'eddsa-rdfc-2022',
    created:            new Date().toISOString(),
    verificationMethod: `${did}#${fragment}`,
    proofPurpose:       'assertionMethod',
  }

  // hashData = SHA-256(RDFC-1.0(proofConfig)) || SHA-256(RDFC-1.0(document))
  const enc = new TextEncoder()
  const [proofConfigCanon, docCanon] = await Promise.all([
    rdfc10(proofConfig),
    rdfc10(credential),
  ])

  const [proofHash, docHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(proofConfigCanon)),
    crypto.subtle.digest('SHA-256', enc.encode(docCanon)),
  ])

  const hashData = new Uint8Array(64)
  hashData.set(new Uint8Array(proofHash))
  hashData.set(new Uint8Array(docHash), 32)

  const sigBytes = new Uint8Array(
    await crypto.subtle.sign('Ed25519', keyPair.privateKey, hashData)
  )

  // proof is embedded without @context (it inherits the credential's context)
  const { '@context': _ctx, ...proofWithoutContext } = proofConfig
  return {
    ...credential,
    proof: { ...proofWithoutContext, proofValue: 'z' + base58btcEncode(sigBytes) },
  }
}
