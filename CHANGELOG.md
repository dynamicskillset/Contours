# Changelog

## v0.12.0 — 2026-03-24

### Open Badge credential improvements

- **Criteria narrative**: now shows progression across snapshots, e.g. "Knowledge 20%→75% (+55pp), Practice 30%→83% (+53pp)..." for multi-snapshot credentials
- **Badge image**: contour thumbnail (1024×1024 PNG) embedded in `achievement.image` so verifiers like VerifierPlus display the visual profile alongside the credential metadata
- **Evidence entries**: each snapshot now includes a human-readable `description` (axes values at that point in time) alongside the machine-parseable `narrative` tag
- **Description field**: optional free-text description added to the Export tab, written to `achievement.description` in the credential
- **Criteria cleanliness**: machine-parseable `[contours:v1:...]` tag removed from the main criteria narrative; it remains in evidence entries where it is needed for round-trip import

### Signing fixes (carried forward from v0.11.x patches)

- `credential.issuer.id` is now set to the derived `did:key` so it matches the `verificationMethod` controller — resolves "signature is not valid" errors in VerifierPlus and `@digitalbazaar/vc`-based verifiers
- `issuer.url` preserved for display; `import.js` reads it back correctly on round-trip
- Removed `created` field from evidence entries; it was silently dropped by our JSON-LD processor but included by some verifiers, causing a hash mismatch

---

## v0.11.0 — 2026-03-18

- Split layout: sticky SVG panel, tabbed controls
- Journal tab: snapshot recording, diff display, timeline, overlay compare mode
- Export tab: Open Badge v3 export with Ed25519 signing (eddsa-rdfc-2022), SVG badge baking, credential JSON download
- Import: round-trip load from baked SVG badge
- DigComp 3.0 framework preset
- Scale selector: 0–100, 0–10, 0–8
