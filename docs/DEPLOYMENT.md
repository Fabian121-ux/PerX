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

Regenerate brand assets after changing `public/image_ux_ux/MAIN_LOGO.jpg` or `public/main_app_logo.png`:

```bash
npm run brand:generate
```

## Environment

- `PERX_DATA_MODE`: set to `database` for Preview and Production.
- `PERX_SIGNUP_MODE`: set to `closed`, `open_beta`, or `public`. Missing values default safely to `closed`.
- `PERX_BETA_MAX_USERS`: required positive integer when `PERX_SIGNUP_MODE=open_beta`; use `10` for the first controlled beta.
- `DATABASE_URL`: required runtime PostgreSQL connection.
- `DIRECT_URL`: required direct PostgreSQL connection for Prisma operations.
- `NEXT_PUBLIC_SUPABASE_URL`: required public Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: required public Supabase publishable key.
- `SESSION_COOKIE_NAME`: required session cookie name.
- `AUTH_SESSION_DAYS`: required session duration.
- `NEXT_PUBLIC_APP_URL`: public canonical URL for metadata; must not be localhost in staging or production.
- `UPLOAD_MAX_BYTES`: required upload limit.
- `LOG_LEVEL`: required logging level.
- `PERX_ENABLE_PREVIEW`: set to `false` unless deliberately enabling static preview routes outside production.
- `ERROR_MONITORING_DSN`: optional until an error-monitoring provider is configured.
- Demo/Test flags should remain disabled in production unless deliberately enabled.

Open beta registration operations are documented in `docs/operations/PERX_OPEN_BETA_REGISTRATION.md`.

## PWA Cache Reset

The service-worker cache is versioned in `public/sw.js` as `perx-public-shell-v5`. Increment it whenever icons, offline shell assets or public cached assets change.

For local hard refresh after icon changes:

1. Open DevTools -> Application -> Service Workers.
2. Click Unregister for the local perX service worker.
3. Clear Storage for the local origin.
4. Hard refresh the page.

Console fallback for local testing:

```js
navigator.serviceWorker
  .getRegistrations()
  .then((registrations) =>
    registrations.forEach((registration) => registration.unregister()),
  );
caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
```

## Cache Policy

The service worker may cache only safe public shell assets. It must not cache:

- `/api`
- `/app`
- `/dashboard`
- `/network`
- `/real-estate`
- `/logistics`
- `/travel-stay`
- `/services`
- `/market`
- `/wallet`
- `/escrow`
- `/service-center`
- `/messages`
- `/notifications`
- `/saved`
- `/reports`
- `/settings`
- `/admin`
- messages
- deals
- mutation responses
- private user data

## Logo/Icon Source

All browser and app icons are generated from `public/main_app_logo.png`. Brand text derivatives are generated from `public/image_ux_ux/MAIN_LOGO.jpg`. Do not replace them with generic icons or legacy SVG marks.
