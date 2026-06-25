# perX UI Reference Page Map

This map records the visual inspection of every valid image in `public/image_ux_ux`.
These files are UI/UX reference screens, not placeholder content images. They should guide layout, colours, spacing, controls, density and responsive behaviour.

## Source-Of-Truth Hierarchy

1. `MAIN_LOGO.jpg` controls the official logo/icon source.
2. `IMG-20260423-WA0067.jpg` controls the main desktop home/dashboard structure.
3. `IMG-20260502-WA0073.jpg` controls mobile/light-mode behaviour.
4. `IMG-20260502-WA0074.jpg` controls dark-mode behaviour.
5. Other screenshots map to route-specific screens and component patterns.

## Global Design Observations

- Brand mark: metallic infinity ribbon with black/charcoal left loop and gold right loop. The source image contains legacy `PER`; visible UI copy must use `perX`.
- Light mode: deep navy sidebar/top brand band, soft off-white page canvas, white cards, light blue selected surfaces, blue primary actions, purple accent for selected tabs and premium panels, green success states and orange/gold notification badges.
- Dark mode: navy/charcoal page and sidebar surfaces, elevated dark panels, purple primary actions and selected states, blue secondary icons, green success, orange notification accents. Gold is not the dominant theme.
- Layout: fixed left sidebar on desktop, structured top header with search and utility actions, three-column dashboard composition where appropriate, right rails for activity/insights/details, dense but readable card systems.
- Mobile: compact navy header, visible search, horizontally scrolling chips/cards with padding, stacked priority content, raised center bottom-nav create action, and safe bottom spacing.
- Cards: mostly 12-20px radius, soft shadows, subtle borders, icon tiles, KPI tiles and content cards with clear headings and compact metadata.
- Buttons: blue/purple primary controls, white/soft secondary controls, clear hover/selected states. Gold appears as brand or badge accent, not a broad button system.

## Image Map

| Filename | Size | Screen/Page Represented | Mode / Device | Components Visible | Colours Extracted | Applies To | Interaction Patterns |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| `MAIN_LOGO.jpg` | 1536x1024 | Official logo reference | Brand source | Metallic infinity mark, black left loop, gold right loop, central legacy text | Black/charcoal gradients, metallic gold, soft highlight shadows | All logo and icon derivatives | Preserve exact mark proportions; use symbol crop for icons; do not use white JPEG directly in UI |
| `IMG-20260423-WA0067.jpg` | 853x1280 | Main desktop home/dashboard | Light desktop | Fixed navy sidebar, top search, story strip, hero, KPI cards, quick actions, opportunities, right activity rail, bottom nav concept | Navy, off-white canvas, white cards, blue actions, purple accent, orange badges | `/app`, `/preview`, dashboard home | Fixed app shell, three-column composition, mobile bottom nav concept |
| `IMG-20260423-WA0067(1).jpg` | 853x1280 | Duplicate main dashboard reference | Light desktop | Same as primary dashboard | Same as primary dashboard | Duplicate reference only | Do not implement separately |
| `IMG-20260423-WA0067(2).jpg` | 853x1280 | Duplicate main dashboard reference | Light desktop | Same as primary dashboard | Same as primary dashboard | Duplicate reference only | Do not implement separately |
| `IMG-20260427-WA0131.jpg` | 854x1281 | Network/profile discovery | Light desktop | Sidebar, header search, tabbed network navigation, profile-strength rail, connection cards, requests, online list, groups | Navy, white, blue selected tabs, green online dots, purple cards | `/app/profile`, `/app/people`, `/preview/profile` | Card grids, profile completion panel, relationship actions |
| `IMG-20260427-WA0132.jpg` | 854x1281 | Travel/discovery marketplace | Light desktop | Category tabs, image hero search, horizontal card shelves, right trips/actions rail | Navy, white, blue actions, pastel category icons | Discovery category pattern | Search hero, filter tabs, horizontal shelves, right rail |
| `IMG-20260427-WA0133.jpg` | 854x1281 | Real-estate discovery/listing | Light desktop | Filter hero, property/listing cards, quick actions, insights rail | Navy, white, blue actions, green/orange status tags | `/app/discover`, opportunities listing | Filter-heavy discovery and result-card layout |
| `IMG-20260502-WA0073.jpg` | 540x1080 | Mobile/light home | Light mobile | Navy mobile header, greeting, search/filter row, horizontal categories, stacked metrics, card carousel, bottom nav | Navy, white, soft blue cards, blue actions, orange badges | Mobile dashboard and mobile app shell | Top bar, search placement, content order, bottom nav safe area |
| `IMG-20260502-WA0074.jpg` | 854x1281 | Dark-mode app/dashboard | Dark desktop/mobile pattern | Dark sidebar, dark cards, search input, active nav, security cards, toggles, bottom nav | Charcoal/navy, dark elevated panels, purple selected states, green success, muted text | Dark mode across app/admin/preview | Do not invert light theme; use explicit dark surface hierarchy |
| `IMG-20260502-WA0075.jpg` | 854x1281 | Marketplace/discover | Light desktop | Search hero, category chips, product/opportunity cards, orders/status rail, quick actions | Navy, white, blue primary, purple highlight, orange badges | `/app/discover`, `/preview/discover` | Filter tabs, shelves, save/status actions, right activity rail |
| `IMG-20260502-WA0075(1).jpg` | 854x1281 | Duplicate marketplace/discover | Light desktop | Same as marketplace reference | Same as marketplace reference | Duplicate reference only | Do not implement separately |
| `IMG-20260502-WA0076.jpg` | 854x1281 | Notifications and preferences | Light desktop | KPI tiles, notification categories, central feed, preferences toggles, insight donut, recent activity rail | Navy, white, blue/purple selected category, green success, orange badges | `/app/notifications`, settings notification panel | Mark-as-read, toggles, category filtering |
| `IMG-20260502-WA0077.jpg` | 854x1281 | Messaging workspace | Dark desktop | Conversation list, active chat, deal context card, right conversation info, tools, media grid, composer | Navy/charcoal, dark panels, purple chat bubbles/actions, white incoming bubbles | `/app/messages`, `/preview/messages` | Three-panel desktop chat; mobile list/detail split |
| `IMG-20260502-WA0078.jpg` | 854x1281 | Reports/admin analytics | Light desktop | Report tabs, KPI row, large charts, shortcuts, insights, downloads, recent reports | White cards, navy sidebar, purple/blue charts, green/orange status | `/admin`, `/app/reports`, platform activity | Chart cards, date/filter controls, report downloads |
| `IMG-20260502-WA0079.jpg` | 854x1281 | Help/service center | Light desktop | Search-led hero, support categories, ticket metrics/table, recommendations, service status, contact rail | Navy, white, blue hero/actions, pastel support tiles | Help/FAQ, `/app/support` | Ticket table, help search, right contact/quick action rail |
| `IMG-20260502-WA0080.jpg` | 853x1280 | Mobile/tablet marketplace home | Light mobile/tablet | Navy top bar, icon category row, search/create/chat row, pastel cards, opportunity carousel, bottom nav | Navy, white, pastel tiles, blue controls, orange logo accent | Mobile dashboard/discover | One full card plus partial next, raised center create action |
| `IMG-20260502-WA0081.jpg` | 854x1281 | Wallet/transactions | Light desktop | Balance hero, action icon grid, spending chart, bills, transfers, transactions, points, linked accounts | Navy/blue hero, white cards, purple points card, green/orange financial signals | Deals/escrow finance states, wallet-like escrow views | Secure-money summaries, transaction lists, quick action grid |
| `IMG-20260502-WA0082.jpg` | 854x1281 | Services discovery | Light desktop | Image hero search, service category grid, service/provider cards, how-it-works, packages, bookings rail | Navy, white, blue actions, pastel icons, green ratings | Opportunity/services discovery, landing sections | Hero search, provider cards, booking quick actions |
| `IMG-20260502-WA0083.jpg` | 854x1281 | Escrow workspace | Light desktop | Security hero, process steps, active escrow table, category summaries, templates, security rail, sticky CTA | Navy/blue hero, white cards, blue actions, green security, orange warnings | `/app/deals`, `/app/escrow`, `/preview/deals` | Escrow process, table rows, templates, sticky CTA |
| `IMG-20260523-WA0072.jpg` | 1280x1024 | Deal calendar/milestones | Light desktop | KPI strip, weekly calendar grid, event chips, create action, agenda/time/assistant rail | Navy sidebar, white calendar, purple primary, pastel event chips | Milestones, deal workspace schedule | Calendar tabs, filter, create deal event, agenda rail |
| `IMG-20260523-WA0073.jpg` | 1280x853 | Profile/trust page | Light desktop | Profile header, actions, verification, deal metrics, trust donut, skills, reviews, completed deals | White, navy sidebar, purple buttons, green trust, red warning | Public profile, app profile, trust score | Trust breakdown, verification checklist, connect/message actions |
| `IMG-20260523-WA0074.jpg` | 1280x853 | Saved/vault page | Light desktop | Search/refine/sort, dark hero summary, category tabs, saved cards, intelligence rail, conversations, quick actions | Navy, white, dark hero, purple actions, green/orange indicators | Saved opportunities, vault/saved items | Saved-item management, refine/sort, side intelligence rail |

## Route Application Summary

- Public landing: use the same navy, white, blue and subtle network-motion language; do not use dashboard screenshots as imagery.
- App dashboard: primarily `IMG-20260423-WA0067.jpg`, mobile from `IMG-20260502-WA0073.jpg`, dark mode from `IMG-20260502-WA0074.jpg`.
- Discover: `IMG-20260427-WA0133.jpg`, `IMG-20260502-WA0075.jpg`, and services/travel marketplace patterns.
- Messages: `IMG-20260502-WA0077.jpg`.
- Deals/Escrow/Milestones: `IMG-20260502-WA0083.jpg`, `IMG-20260502-WA0081.jpg`, and `IMG-20260523-WA0072.jpg`.
- Profile/Trust: `IMG-20260427-WA0131.jpg` and `IMG-20260523-WA0073.jpg`.
- Notifications/Help/Reports/Admin: `IMG-20260502-WA0076.jpg`, `IMG-20260502-WA0079.jpg`, and `IMG-20260502-WA0078.jpg`.
- Saved/Vault: `IMG-20260523-WA0074.jpg`.

## Implementation Guardrails

- Do not use these screenshots as opportunity thumbnails, avatars, content photography, hero media or decorative placeholders.
- If a real content image is required and no local content asset exists, it must be declared in `src/lib/data/temporary-images.ts` and documented in `docs/TEMPORARY_IMAGE_REPLACEMENT.md`.
- Keep gold limited to logo, verification/trust accents, notification badges and selected premium details.
- Use fixed desktop app shell and mobile drawer/bottom navigation patterns from the references.
