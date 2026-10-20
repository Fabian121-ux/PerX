# preX — VPS Media Storage Draft Program (execution checklist)
**DRAFT ONLY — no VPS, Vercel, or Supabase production resources have been modified.**  
Architecture: [Vercel + VPS draft](../architecture/vercel-vps-media-storage-draft-20261020.md)

## Program objective
Move user-uploaded **image, voice, document and (later) video bytes** onto a VPS-backed S3-compatible object store. Use Vercel for application/authz/signing API and Supabase Free for compact relational records. The aim is to minimize Supabase Storage usage and avoid accidental large blob/egress pressure without weakening privacy or data retention.

## Work packages and exit gates

### WP0 — Baseline and operating budget (design approval)
- [ ] Confirm VPS vendor, availability zone, OS, available SSD capacity, outgoing transfer limit/cost, planned hostname and who has server access.
- [ ] Establish Supabase Storage used (GB), Storage egress, DB used (MB), Vercel invocation/egress baselines for one billing cycle.
- [ ] Forecast retained files: each feature's upload count × average normalized size × retention months × redundancy/backups.
- [ ] Agree maximum allowed storage/egress cost and a threshold for temporarily disabling new uploads without blocking normal text messaging.
- [ ] Confirm who operates backups, storage patching, abuse tickets and recovery.
- [ ] No VPS access or purchase authorization implied.

**Gate 0:** architecture and operating budget approved by project owner.

### WP1 — VPS proof of concept (isolated staging)
- [ ] Prepare hardened VPS OS, TLS hostname, firewall, monitored persistent volume and authenticated object store.
- [ ] Compare Garage with another maintained S3-compatible server using **required** features rather than simply assuming presigned URL, multipart, CORS and size restrictions work.
- [ ] Create strictly separate staging public and private buckets.
- [ ] Verify anonymous GET on private bucket returns a denial and admin API is not public.
- [ ] Configure separate restricted read/write credentials and test zero secrets in browser.
- [ ] Configure encrypted off-site backup including storage **metadata**; test full restore.
- [ ] Run load test with concurrency, connection failures, corrupted payloads, large files, quota exhaustion and restarts.

**Gate 1:** signed staging compliance/security/restore checklist; no production migration.

### WP2 — Portable storage interface and DB model
- [ ] Introduce server-only storage interface; pin and lock any new dependencies.
- [ ] Explicitly record provider per file (`supabase_legacy` or `vps_s3`), random key, ownership, target record, visibility, size, hash, MIME and moderation state.
- [ ] Keep legacy URL readers while VPS implementation is developed; never rely on client-supplied URLs.
- [ ] Exercise schema migration on disposable development Postgres; do not apply Auth migration or manual production SQL.
- [ ] Add unit and authorization tests covering provider routing, stale sessions, block changes and deleted messages.

**Gate 2:** CI, end-to-end authorization matrix, zero production schema changes.

### WP3 — Direct signed upload / verify / publish / delete
- [ ] Authenticated upload-intent API with quotas, sizes, content types, random keys, expiry and owner linkage.
- [ ] Browser-to-VPS direct bytes over HTTPS and storage-enforced size cap; verify correct CORS and content-length support.
- [ ] Server finalization with HEAD, magic-byte/decoder check, content hash and media-type normalization.
- [ ] Store originally uploaded content only when necessary; strip EXIF, generate public-safe variants and quarantine sensitive media before release.
- [ ] For voice/video, use a managed process/worker on VPS for transcoding with bounded disk/CPU/time and protected input files.
- [ ] Storage-gateway read authorization, signed GET TTL/revocation policy, no-referrer/no-store for private content.
- [ ] Orphan cleanup, retryable deletes, audit/event metrics, abuse limits.

**Gate 3:** private/public integration + abusive upload tests; no direct public private-media URLs.

### WP4 — Feature migration order
- [ ] **Avatar** upload and download: low-risk pilot for non-sensitive public content.
- [ ] **Listing** images: preserve existing cover selection and moderation.
- [ ] **Chat photos**: require active membership, no blocks, deleted-message denial, short-lived signed/private gateway access. Replace the current Supabase-specific implementation; do not create a Supabase chat bucket if the project instead adopts VPS storage.
- [ ] **Voice notes**: separate capability rollout with safe MIME, duration, data retention and accessibility.
- [ ] **Documents/attachments**: private, no public indexes, malware scanning and deny HTML/SVG execution.
- [ ] **Optional videos**: introduce compression, quotas and background processing only after measurement.

**Gate 4:** two real accounts validate each feature plus negative security cases.

### WP5 — Existing object migration and launch
- [ ] Count and classify current Supabase objects by private/public scope.
- [ ] Copy in resumable batches to VPS, checksum each, preserve owner and moderation flags.
- [ ] Support both sources and roll back read routing per record if needed.
- [ ] Measure actual VPS, Vercel and Supabase transfer use in limited rollout.
- [ ] Keep prior Supabase objects until restored backup and full reconciliation proven.
- [ ] Change new-upload default to VPS only after verification. No silent migration.
- [ ] Define deletion retention and request process before decommissioning existing buckets.

**Gate 5:** owner approves full cutover after checksums, restores, security testing and cost review.

## Operational stop conditions
Block **new** large-file uploads but preserve messaging/feed reads when:
- VPS storage volume passes critical disk or inode threshold.
- Private content becomes anonymously readable.
- Encryption credentials leak or object metadata cannot be trusted.
- Upload or delete queues are persistently unhealthy.
- Offsite backup and recovery verification lapses.
- User uploads exceed policy or measured budget unexpectedly.

## Information needed before real rollout
1. VPS provider/plan, CPU, RAM, persistent SSD space, OS, monthly traffic cap.
2. Domain/subdomain chosen for the media endpoint and whether HTTPS/WAF/CDN is available.
3. Expected file categories (images, voice, documents, video) and maximum sizes.
4. A realistic monthly media traffic/storage budget.

**Reminder:** This document is a deployment/program draft. It is not an installer, functioning storage adapter, paid server reservation or a production rollout.
