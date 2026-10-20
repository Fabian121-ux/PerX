# Private chat images — October 20, 2026

## What is implemented
- The + menu now opens a JPEG/PNG/WebP photo picker; voice notes remain deliberately **Coming soon**.
- Photos are sent as genuine conversation Message records with one approved MessageAttachment, using the **existing** Prisma tables. No database migration required.
- Maximum 5 MiB. MIME + extension + image file signature (JPEG/PNG/WebP) are checked on the server. SVG, PDFs and arbitrary files are not accepted.
- Images are stored under randomized keys in the separately configured **private** Supabase Storage bucket `message-images` (override with `SUPABASE_MESSAGE_BUCKET`).
- The DB stores only a private Storage object path, never a public image URL or service-role token. Client message JSON receives only internal `/api/messages/images/<attachmentId>` URLs.
- The image GET route reauthorizes the current viewer **on every request** through existing conversation scope, including removed participants, bidirectional blocks and deleted messages, and responds with `Cache-Control: private, no-store` and `nosniff`. No signed public URL is generated.
- Uploads require a current session, acceptable account restrictions, active two-person conversation, accepted connection for direct chats, no blocks, and the same 20 messages/minute rate limit as text sends. Upload + transactional message write attempts to delete orphaned blobs on failed writes.
- The historical, realtime, and paginated message projections all include only approved photo attachments. The client shows a photo bubble via its authenticated URL.

## REQUIRED before production photo sharing
1. In the same Supabase project as existing profile/listing images, create a NEW bucket **`message-images`**, set **Public: OFF / Private**, and enforce a maximum file size of 5 MB with allowed MIME types `image/jpeg`, `image/png` and `image/webp`. **Never turn this bucket public.**
2. Configure `SUPABASE_MESSAGE_BUCKET=message-images` (optional if using that name), `NEXT_PUBLIC_SUPABASE_URL` and existing **server-side only** `SUPABASE_SERVICE_ROLE_KEY` in the deployed environment. Do not expose the role key to clients.
3. Run a two-member review: send, receive, paginate, refresh, block, remove participant, delete photo message, fetch image as logged-out third party; verify access is denied after revocation. Check CORS and storage limits; monitor failed upload cleanup.
4. Until this private bucket exists, photo selection is visible but will return a controlled storage-unavailable error rather than sending a broken or public attachment.

## Follow-ups
- File and image virus scanning, optional EXIF stripping and retention/garbage collection jobs are future hardening before high-volume rollout.
- Voice notes and general file attachments are not enabled.
- End-to-end encryption is not claimed. Message images are private, but server-operated Storage and service-role infrastructure can read them.

## No irreversible changes
No Supabase bucket was created automatically; no production schema or auth rollout was changed.
