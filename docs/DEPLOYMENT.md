# perX Deployment Notes

## Required Commands

Before deployment:

```bash
npm run lint
npm run type-check
npm run test
npm run test:e2e
npm run build
npx prisma validate
```

Regenerate brand assets after changing `public/image_ux_ux/MAIN_LOGO.jpg`:

```bash
npm run brand:generate
```

## Environment

- `DATABASE_URL`: required for production Prisma/PostgreSQL.
- `NEXT_PUBLIC_APP_URL`: public canonical URL for metadata.
- Demo/Test flags should remain disabled in production unless deliberately enabled.

## PWA Cache Reset

The service-worker cache is versioned in `public/sw.js` as `perx-public-shell-v3`. Increment it whenever icons, offline shell assets or public cached assets change.

For local hard refresh after icon changes:

1. Open DevTools -> Application -> Service Workers.
2. Click Unregister for the local perX service worker.
3. Clear Storage for the local origin.
4. Hard refresh the page.

Console fallback for local testing:

```js
navigator.serviceWorker.getRegistrations().then((registrations) => registrations.forEach((registration) => registration.unregister()));
caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
```

## Cache Policy

The service worker may cache only safe public shell assets. It must not cache:

- `/api`
- `/app`
- `/admin`
- messages
- deals
- mutation responses
- private user data

## Logo/Icon Source

All browser and app icons are generated from `public/image_ux_ux/MAIN_LOGO.jpg`. Do not replace them with generic icons or legacy SVG marks.
