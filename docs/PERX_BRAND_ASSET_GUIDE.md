# perX Brand Asset Guide

## Official Spelling

Visible product copy must use `perX`.

Do not display `preX`, `PreX`, `PerX`, `PERX`, `PER`, `Prime Nest` or `PrimeNest` in the UI.

## Source Files

- Official logo source: `public/image_ux_ux/MAIN_LOGO.jpg`
- Source archive copy: `public/brand/source/perx-original-reference.jpg`
- Desktop UI reference: `public/image_ux_ux/IMG-20260423-WA0067.jpg`
- Mobile/light reference: `public/image_ux_ux/IMG-20260502-WA0073.jpg`
- Dark reference: `public/image_ux_ux/IMG-20260502-WA0074.jpg`

## Logo Construction

The logo source contains a metallic infinity ribbon:

- Black/charcoal left loop.
- Gold right loop.
- Layered metallic ribbon construction.
- Central crossing structure.
- Strong symmetry and continuity symbolism.

The source JPEG contains legacy center text. Derivatives mask that text and pair the mark with a correct `perX` wordmark. The result remains derived from the approved source and is not a generic infinity replacement.

## Generated Assets

Run:

```bash
npm run brand:generate
```

Generated brand files:

- `public/brand/perx-logo.png`
- `public/brand/perx-logo-light.png`
- `public/brand/perx-logo-dark.png`
- `public/brand/perx-logo-horizontal.png`
- `public/brand/perx-logo-horizontal-light.png`
- `public/brand/perx-logo-horizontal-dark.png`
- `public/brand/perx-symbol.png`
- `public/brand/perx-symbol-light.png`
- `public/brand/perx-symbol-dark.png`
- `public/brand/perx-symbol-monochrome.png`
- `public/brand/perx-wordmark.png`
- `public/brand/perx-wordmark-light.png`
- `public/brand/perx-wordmark-dark.png`

Generated icons:

- `public/favicon.ico`
- `public/icons/favicon-16x16.png`
- `public/icons/favicon-32x32.png`
- `public/icons/apple-touch-icon.png`
- `public/icons/icon-192.png`
- `public/icons/icon-512.png`
- `public/icons/maskable-icon-192.png`
- `public/icons/maskable-icon-512.png`

## Usage

- Full/horizontal logo: public header, expanded app sidebar, admin sidebar, auth pages, offline page and footer.
- Symbol only: collapsed sidebar, mobile menu trigger, favicon, PWA icons and small app markers.
- Wordmark only: constrained horizontal spaces where the symbol would be visually redundant.

All React rendering should go through `src/components/brand-logo.tsx`.

## Colour Tokens

The UI system follows the reference screenshots, not the previous black-and-gold theme.

- Light page: `#f4f7fb`
- Light surface: `#ffffff`
- Sidebar/navy: `#061936`
- Header: `#f8fafc`
- Primary action: `#2563eb`
- Secondary accent: `#5b46f2`
- Dark page: `#0f1726`
- Dark surface: `#162235`
- Dark elevated: `#21314a`
- Gold: limited to logo, verification/trust accents and occasional badges.

Semantic variables live in `src/app/globals.css`.

## Typography and Components

- Font: Geist Sans with Geist Mono for code-like data where needed.
- Cards: 16px base radius, subtle borders, soft shadows, compact metadata.
- Buttons: blue/purple primary system; light/dark secondary surfaces; visible focus rings.
- Mobile: navy header, visible search, padded horizontal scrollers, safe bottom navigation.

## Prohibited Logo Changes

- Reversing the black and gold sides.
- Stretching or rotating the mark.
- Replacing it with a generic infinity symbol.
- Using unrelated colours.
- Showing `PER` as the product name.
- Using the white-background JPEG directly in the interface.
- Creating a favicon with unreadable full wordmark text.
- Using any old `preX` SVG or temporary icon.

## Known Limitation

The current source has text over the crossing. Generated derivatives mask the text, but minor crossing artifacts remain. A future transparent official source would allow cleaner derivatives without changing the visual identity.
