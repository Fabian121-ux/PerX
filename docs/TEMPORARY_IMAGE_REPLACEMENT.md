# Temporary Image Replacement Policy

UI reference screenshots in `public/image_ux_ux` are not content images and must not be used as opportunity thumbnails, avatars or decorative placeholders.

## Current Temporary Images

Temporary content imagery is centralized in `src/lib/data/temporary-images.ts`.

| Key | Source | Current Use | Alt Text |
| --- | --- | --- | --- |
| `opportunityDesign` | Unsplash | Design opportunity thumbnails | Designer reviewing a product interface on a laptop |
| `opportunityEngineering` | Unsplash | Engineering opportunity thumbnails | Software engineer working on a secure application dashboard |
| `opportunityStartup` | Unsplash | Startup/collaboration opportunity thumbnails | Startup collaborators planning a product roadmap |
| `opportunityOperations` | Unsplash | Operations opportunity thumbnails | Operations team reviewing business workflows |

## Rules

- Do not scatter remote image URLs across components.
- Use `next/image` with stable dimensions and responsive `sizes`.
- Keep accessible alt text.
- Avoid layout shifts and stretched crops.
- Keep remote hosts restricted in `next.config.ts`.
- Replace temporary URLs with owned perX content assets before production launch when available.

## Replacement Process

1. Add the owned asset to an approved public asset folder.
2. Update `src/lib/data/temporary-images.ts` or replace the helper with local image metadata.
3. Remove unneeded remote image patterns from `next.config.ts`.
4. Re-run lint, type-check and build.
5. Update this document with the replacement record.
