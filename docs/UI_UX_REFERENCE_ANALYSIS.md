# UI/UX Reference Analysis

Audit date: 2026-06-24  
Source directory: `public/image_ux_ux`

## Inspection Method

Every valid JPEG in `public/image_ux_ux` was decoded and visually inspected. The files are UI/UX screenshots rather than deployable product photos, so they were used as design references for layout, components, density, navigation and colour rather than inserted into the app as decorative screenshots.

The source logo at `public/icons/LOGO.jpeg` was also visually inspected. It contains a gold infinity-inspired symbol, which informed the final recreated SVG brand system.

## Product Character

The references describe a serious marketplace/productivity application rather than a marketing landing page. The dominant feeling is operational, compact and trust-oriented:

- Dark navy product shell with white or very light grey working canvas.
- Blue primary actions and active states.
- Purple used for premium/dark panels and visual depth.
- Gold/orange used for attention, notification, wallet and brand accent moments.
- Green reserved for verification, success, funding, approval and trust.
- Soft rounded cards with subtle shadows and clear internal spacing.
- Dense dashboards with left navigation, top search, right rails, status chips and compact data cards.

## Layout Structure

Public discovery screens use a strong hero/search area followed by filter cards and opportunity/listing cards. The search surface is prominent, rounded and slightly elevated. Listing cards often contain a visual header area, category/status chips, short summary text, save controls and structured metadata.

Authenticated app screens consistently use:

- Dark left navigation rail.
- White or light page canvas.
- Top bar with search/profile/actions.
- Compact metric cards.
- Main content grid plus optional right rail.
- Rounded cards with clear borders and soft shadows.

Admin and analytics references use the same shell but increase information density with metric tiles, tables, charts and moderation/activity panels.

## Navigation

Desktop navigation patterns:

- Dark vertical sidebar for app/admin.
- Compact top bar for user/profile controls.
- Icons paired with short labels.
- Active states shown with bright blue or white-on-navy contrast.

Mobile navigation patterns:

- Navy top app bar.
- Horizontal category shortcuts.
- Large search input.
- Bottom navigation with icons.
- Stacked cards instead of compressed desktop grids.

## Components

Cards:

- Rounded between roughly 12 and 24 px.
- Soft white surfaces on light background.
- Dark cards for priority dashboards and messaging.
- Header visual bands on marketplace/opportunity cards.
- Chips and badges are pill-shaped and compact.

Forms and search:

- Inputs are rounded with light border and strong focus state.
- Search bars are wide, prominent and often placed inside an elevated filter surface.
- Select/filter controls sit beside search on desktop and stack on mobile.

Tables and lists:

- Compact rows.
- Status badges.
- Avatar/initial cells.
- Currency/status values aligned to the right where useful.

Messaging:

- Dark three-column composition.
- Conversation list on left, chat in the centre, participant/details panel on right.
- Purple/blue outgoing bubbles and muted incoming bubbles.
- Chat remains separate from proposal/deal/escrow actions.

Deals and escrow:

- Security-forward panels.
- State tables and milestone rows.
- Wallet-like balance cards.
- Green approval/release states, orange funding/attention states and red dispute states.

Profiles and trust:

- Profile header with avatar, verification, role and trust indicators.
- Trust breakdown cards rather than unexplained scores.
- Review cards with eligibility context.

## Extracted Design Tokens

The implementation centralises these token directions in `src/app/globals.css`:

- Primary: deep trust blue.
- Secondary: dark navy shell.
- Accent: gold/orange from the source logo.
- Purple: used only for depth and dark panel gradients.
- Page background: cool off-white.
- Surface: white.
- Muted surface: pale blue-grey.
- Border: light cool grey.
- Text: deep slate/navy.
- Success: green.
- Warning: gold/orange.
- Error: red.
- Focus: blue ring.
- Shadow: low, soft operational shadows.
- Radius: compact rounded cards and buttons, not oversized pill-only UI.

## Implementation Implications

- perX should feel like one coherent operating system across public, app and admin areas.
- Generic scaffold cards should be replaced with dashboard-style components, visual card bands, structured metadata and stronger navigation.
- The logo should not reuse the JPEG directly; it should be recreated as scalable vector artwork.
- The UI should not use external stock photos because the references provide the approved visual direction.
- Duplicate reference screenshots should inform recurring patterns but should not be forced into the app.
