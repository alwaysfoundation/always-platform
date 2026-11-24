# ADR 0016: Private sync for Always AI

Status: Proposed
Date: 2026-11-24
Related: ADR 0015

## Context

Always AI runs on the person's device (ADR 0015). People use more than one device and want their library to follow them. Storage can be end-to-end encrypted because it never needs to read data; a cloud model cannot, because it must read a request to answer it. Always must stay free and must not hold anyone's data.

The framework is published at alwaysfoundation.org/#/private-ai-sync ("Local AI and private sync: how Always AI stays free and private").

## Decision

1. **Three layers.** Local AI on the device (always on); private sync (optional, off by default); cloud AI (only by the person's choice, with the trust level shown: on device, sealed hardware, or provider promise).
2. **End-to-end encrypted sync.** A random key is created on the first device and never sent to storage. Every change is encrypted on the device with authenticated encryption from a well-reviewed open library. File names and structure are encrypted and sizes padded.
3. **Keys move by QR code, device to device.** Adding a device never passes the key through storage. A recovery code is shown at setup.
4. **Conflict-free merging.** Concurrent edits merge using CRDT-style data structures.
5. **Bring your own storage by default.** The locked library can live in the person's existing cloud folder (iCloud Drive, Google Drive, Dropbox, OneDrive), move directly between devices on a local network or by file, or use a church's own open-source sync server.
6. **An open sync standard.** Any provider may implement it and offer hosted sync, paid or free, on equal terms. Providers carry encrypted data they cannot read. People can export and leave at any time.
7. **Always runs no sync service and holds no keys.** Always cannot recover a library if every device and the recovery code are lost.
8. **Hard places.** Sync is off until turned on; device-to-device sync needs no account; the app can lock and quickly remove the library.
9. **Free stays free.** Always never charges for Always AI, the sync software or the standard. Providers may charge for optional services; the free path remains.

## Consequences

- No central cost grows with users; storage is borne by the person's existing accounts or a provider they choose.
- Storage can still see that an account exists, approximate size and timing of changes. This is stated plainly to users.
- Lost keys mean lost data; the app must make this clear before sync is turned on.
- The sync standard, its threat model and test vectors must be published before third-party providers are invited.
- The Always name may be used by providers only to say they work with Always AI, not as their own brand, and not with weakened safeguards.
- No personal data is processed on Always infrastructure, so the data-residency rule (non-negotiable 5) is not engaged. Any Always-run sync or AI service would need a new ADR.
