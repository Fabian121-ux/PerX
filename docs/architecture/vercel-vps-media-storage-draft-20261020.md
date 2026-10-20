# DRAFT — preX hybrid hosting: Vercel + VPS media, Supabase Free metadata
**Status:** architecture proposal / not deployed / not a production change  
**Date:** 2026-10-20  
**Project:** preX (PtahX / former Prime Nest)

## 1. Decision and non-goals
Use **Vercel** for the preX Next.js application and APIs, keep **Supabase Free/PostgreSQL** for structured application data, and use a separately operated **VPS** for image, audio and other large file bytes. This is specifically to avoid filling Supabase Storage/egress with user media and to extend the useful lifespan of the free tier.

**The VPS is not a replacement for Supabase Postgres or authentication.** Do not move user passwords, sessions, private tokens, Deals, proposals, audit events, moderation records, or app relational data into unstructured files. Existing app access controls must remain authoritative.

**Not yet authorized:** changing production VPS configuration; provisioning buckets, paying for a VPS, migrating production media, switching live traffic, removing Supabase buckets, changing production DB schema, or changing the staged Supabase Auth migration.

## 2. Proposed component boundaries

```text
Web/mobile browser
   |                                     public media (only) -> media.prex-domain.example/CDN
   +--> preX Next.js @ Vercel ----------- authenticated API / upload session
           |            |
           |            +--> VPS HTTPS S3-compatible Object API  <-- direct signed browser PUT
           |                    |-- public, sanitized profile/listing/feed images
           |                    +-- private conversation media, evidence, originals
           |
           +--> Supabase Postgres / Prisma
                    |-- users, access, consent, blocks
                    |-- messages, attachments, Deal/proposal state
                    |-- object metadata / provider / status / ownership
                    +-- audit logs and upload-session state
```

Vercel Functions have **ephemeral** filesystem storage (only scratch `/tmp`), so files must never be written to Vercel's disk as durable user data. For uploads, Vercel authenticates the user and authorizes the operation, then creates an **upload session** with one short-lived signed write capability for a random object key. The browser sends bytes **directly to VPS object storage over TLS**, bypassing both Supabase Storage and Vercel application bandwidth. After upload, the app verifies the object and finalizes DB metadata. The provider is not trusted merely because a browser says a file was uploaded.

For reads, public, moderated images can be served over VPS HTTPS / future CDN. **Private messages MUST require a new access check** before a read capability is issued. A short-lived signed private GET URL is a bearer token until expiry: use a very short TTL, `Cache-Control: private, no-store`, no public CDN, no-referrer, and understand that an already-issued URL cannot be instantly revoked. If instantaneous block/revocation is required, stream a private item through an authorization gateway instead of issuing a direct signed GET URL; that increases bandwidth cost at the gateway. Decide explicitly after testing.

## 3. VPS storage implementation choice
Choose an actively maintained, **S3-compatible object store** on the VPS, rather than inventing a file upload API around a publicly served directory. **Garage** is one candidate for small self-hosted deployments; verify its exact multipart/presigned features and operational readiness in a staging trial. Alternatives include SeaweedFS or another maintained S3-compatible implementation. Do **not** select archived, unmaintained MinIO Community releases for a new internet-facing installation.

Minimum production controls:
- Dedicated attached persistent disk/volume (not container root filesystem) and room for growth; encrypted transport, private buckets, firewall, non-root service account, non-public admin/metrics ports, vendor-pinned upgrades.
- Separate `prex-public-media` and `prex-private-media` buckets; no anonymous access to the private bucket. Protect public content until moderation approves it.
- HTTPS DNS endpoint, restrictive CORS for the preX site, private object names, least-privilege per-bucket service credentials stored only in **Vercel server-side** environment settings. Never use `NEXT_PUBLIC_` for secrets.
- Disk space/inode alerts, object totals, request rate and traffic monitoring, malware/image parser protections, abuse throttling, periodic patching, emergency credential rotation.
- Nightly encrypted **off-VPS backup** of both objects and object-store metadata; verify periodic restores. A single VPS disk, a snapshot on that same VPS or replication within one physical machine is **not a backup**.

## 4. Data allocation matrix

| Data | Authoritative location | Access rule |
| --- | --- | --- |
| User accounts, app sessions, permissions, blocks | Supabase Postgres | Existing session/Prisma authorization |
| Posts, comments, reactions, messages, proposals, Deals | Supabase Postgres | Existing relational ACLs and audits |
| Object ID, owner, content type, size, state, storage key/provider | Supabase Postgres | Authenticated metadata only, minimal bytes |
| Listing pictures, public avatar pictures, published post images | VPS public bucket after moderation | Published/eligible only; cache carefully |
| Chat photos, voice notes, attachments | VPS private bucket | Authorized current conversation member only |
| Private review evidence, submitted documents | VPS private bucket | Scoped administrative access / owner permissions |
| Logs, backups and encryption keys | Protected operations systems / off-site backups | Strict separate access |

Do not store base64 images, blobs or voice payloads in Postgres/JSON columns; only identifiers and metadata.

## 5. Draft application programming contracts (not implemented)

**Provider adapter** (server-only):

```ts
type MediaVisibility = "PUBLIC" | "PRIVATE";
type MediaPurpose = "AVATAR" | "LISTING" | "POST" | "CHAT_IMAGE" | "VOICE" | "DOCUMENT";

type StorageObject = {
  id: string;
  provider: "SUPABASE_LEGACY" | "VPS_S3";
  purpose: MediaPurpose;
  visibility: MediaVisibility;
  ownerId: string;
  relatedRecordId: string;
  bucket: string;           // selected server-side, never chosen by client
  objectKey: string;        // cryptographically random, no supplied path
  declaredMime: string;
  actualMime?: string;      // verified after upload
  bytes: number;
  checksumSha256?: string;
  status: "RESERVED" | "UPLOADED" | "SCANNING" | "APPROVED" | "REJECTED" | "DELETED";
  createdAt: Date;
};
interface MediaStorage {
  createWriteGrant(input: {
    objectKey: string; bucket: string; contentType: string; maxBytes: number; ttlSeconds: number;
  }): Promise<{ url: string; method: "PUT" | "POST"; requiredHeaders?: Record<string, string> }>;
  stat(input: { bucket: string; objectKey: string }): Promise<{ bytes: number; contentType: string; checksum?: string }>;
  createReadGrant(input: { bucket: string; objectKey: string; ttlSeconds: number }): Promise<string>;
  remove(input: { bucket: string; objectKey: string }): Promise<void>;
}
```

**Proposed API workflow**:
1. `POST /api/media/uploads/intent` → user/session + account restrictions + purpose-specific permissions + quotas + MIME/size allowlist; insert `RESERVED` row, issue randomized path and short signed upload capability. **No arbitrary bucket or path input.**
2. Browser uploads directly to VPS S3 endpoint via HTTPS using the supplied method and exact allowed headers. Enforce an actual maximum object size at the storage/gateway layer; client-side limits alone, or a plain signed PUT URL without byte-length enforcement, are insufficient.
3. `POST /api/media/uploads/:id/complete` → fresh session/permission check; HEAD object; size, signature/magic-byte, decoder and checksum verification; image normalization and EXIF stripping where appropriate; AV/quarantine for docs; update media row to `APPROVED` only after processing. Insert/link domain attachment record transactionally; never trust client-provided URL or MIME.
4. `GET /api/media/:id/access` → check viewer's *current* relation to owner/post/conversation/Deal and block/moderation status; return a very short private grant (or gateway stream), or a published public URL. Private responses and logs never leak full signed grants or secrets.
5. `DELETE /api/media/:id` → check owner/moderator, tombstone metadata, remove object via asynchronous retryable job, scrub caches and enforce data retention policies.
6. Reaper job → expire unused upload sessions, remove orphan objects, garbage-collect removed media, emit audit metrics. Cron jobs must authenticate to the backend, be idempotent, rate-limited, and avoid listing whole buckets per request.

**Upload size defaults for review** (not guaranteed settings): avatar 2 MB, listing/post image 5 MB, chat image 5 MB, voice note 10 MB, document 15 MB. Explicit limits by purpose; never accept unlimited uploads. Confirm compression/cost and moderation decisions before rollout.

**Suggested backend-only env names**:
```env
MEDIA_STORAGE_PROVIDER=supabase_legacy  # keep unchanged until gated cutover; staging may use vps_s3
MEDIA_S3_ENDPOINT=https://media-api.example.invalid
MEDIA_S3_REGION=us-east-1
MEDIA_S3_PUBLIC_BUCKET=prex-public-media
MEDIA_S3_PRIVATE_BUCKET=prex-private-media
MEDIA_S3_ACCESS_KEY_ID=SET_IN_VERCEL_SERVER_ENV_ONLY
MEDIA_S3_SECRET_ACCESS_KEY=SET_IN_VERCEL_SERVER_ENV_ONLY
MEDIA_PUBLIC_BASE_URL=https://media.example.invalid
MEDIA_UPLOAD_MAX_BYTES=5242880
```
The endpoint and sample domains are **placeholders**, not real configuration. Never commit values for the credentials. Use HTTPS and avoid SSRF: only approved exact operator-configured endpoints, not user-supplied URLs.

## 6. Existing preX code and migration strategy
Existing production/main code is **currently Supabase-specific** in:
- `src/lib/uploads/profile-image.ts` and `src/app/api/profile/image/route.ts`.
- `src/lib/uploads/listing-image.ts` and `src/app/api/opportunities/[opportunityId]/images/route.ts`.
- `src/lib/uploads/message-image.ts` and `src/app/api/messages/images/{route.ts,[attachmentId]/route.ts}`.
- Prisma `User`, `Profile`, `OpportunityImage`, `MessageAttachment` records; several fields assume the prior public URL or private bucket key representation.
- Feed/post image support should be planned separately; do not assume an image upload feature already exists on social posts.

**Phase A — Infrastructure readiness (no cutover).** Provision/test isolated staging VPS service; validate S3 endpoint compatibility, private/public isolation, CORS, TLS, quotas, backup/restore and resource monitoring. Use temporary synthetic media. No production credentials or data.

**Phase B — Server storage interface (feature flagged).** Define typed `MediaStorage` adapter and S3 implementation with official maintained Node SDK, pinned dependencies/lockfile. Add a `provider` discriminator and explicit storage key to metadata without rewriting old keys. Any Prisma migration must be reviewed and first applied to an isolated non-production DB with migration manifest updated. Legacy file reads remain available; no new media to Supabase by default once VPS cutover enabled.

**Phase C — Upload lifecycle.** Implement direct-to-VPS signed intent/complete, server-side validation, throttling and cleanup. Integrate profile images first, then listing images, then chat photos, then voice/docs. Never mark pending/quarantined media public.

**Phase D — Dual-provider reads.** Old Supabase objects remain readable, while **new** approved objects are written to VPS behind `MEDIA_STORAGE_PROVIDER=vps_s3`. Guarantee correct per-record routing; do not decide backend from file extension, URL substring or the currently configured default provider. Regression tests for mixed Supabase + VPS pages.

**Phase E — Migration.** Inventory active Supabase objects; export/copy to VPS; compare object length/checksum; write mapping in transactional batches; verify private auth before pointing to new object; switch reads per record; maintain rollback and prior objects during a fixed verification period. Do not bulk-delete old Supabase media until there is a verified offsite backup and a signed-off integrity/recovery report.

**Phase F — Gradual production rollout.** Release to internal testers first with usage dashboards, then limited cohorts, then all eligible users. Emergency rollback via configuration flag and dual-provider reads. Never migrate Auth with this storage change.

## 7. Acceptance tests / go-no-go
- Unauthenticated and unrelated users cannot read private chat media, including when holding a guessed object ID/key.
- Both-direction blocks, expired sessions, removed conversation participants, deleted messages and moderation revocations deny **fresh** media access. Document the residual access window for already-issued signed URLs.
- Uploading forged MIME, unexpected headers, oversized files, SVG/HTML executables, corrupt images and ZIP bombs must fail safely. Quarantine before display.
- Browser upload bytes go **Vercel -> intent only; browser -> VPS for bytes**. Inspect network to ensure bytes do not pass through Supabase or Vercel proxies.
- DB only stores compact metadata; no base64 payloads. No public bucket leakage and no service credentials in browser bundles/JSON or logs.
- Migration tests prove old Supabase content renders while new VPS uploads work and blocks still apply; backup/restore and rollback successfully tested.
- Track VPS disk %, offsite backup age, monthly VPS bandwidth, Vercel invocations/egress, Supabase storage/egress, failed uploads and leaked/orphan files.

## 8. Budget and constraints
Supabase Free currently lists **500 MB database** and **1 GB storage** allowances, with separate egress and other quotas; moving file **bytes** out reduces Supabase Storage usage but **does not shrink database records, Realtime usage, or automatically eliminate every Supabase egress request**. Vercel and VPS have their own bandwidth/compute limits and potential overage costs. Model monthly uploads, retained GB, average image variants, expected downloads, offsite backups and VPS outbound traffic before choosing a VPS size.

The most important initial input is whether a VPS already exists and, if so, its **OS, storage size, provider and a hostname controlled by preX**. No VPS access, credentials, server address or production cutover was supplied in this request: the architecture remains a draft.

## 9. References (verified 2026-10-20)
- Vercel Functions filesystem: https://vercel.com/docs/functions/runtimes
- Supabase Free pricing/usage: https://supabase.com/docs/guides/platform/billing-on-supabase
- AWS S3 presigned URL guidance and limitations: https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html
- AWS SDK for JavaScript v3 presigner: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-s3-request-presigner/
- Garage S3-compatible object store project: https://github.com/deuxfleurs-org/garage
- MinIO archived community repository: https://github.com/minio/minio

**Draft review required before any deployment.**
