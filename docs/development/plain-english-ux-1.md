# PLAIN-ENGLISH-UX-1

Concrete review candidates found during the auth-stage source review:

- Home/feed: “Explore the ecosystem” and “posts from across the ecosystem”
  (`src/components/feed/home-feed.tsx`) could name the people or opportunities.
- Opportunity composer: “trust-backed records”
  (`src/components/opportunities/opportunity-composer.tsx`) needs a concrete
  explanation without implying a guarantee or financial protection.
- Profile: “improves discovery, trust” (`src/app/app/profile/page.tsx`) could
  explain how profile details help people find and assess the member.

A future rendered-state audit should cover home/feed, create post, opportunities,
trader onboarding, network/connections, messaging, notifications, profile,
settings, user reports, trust/reputation and user-visible admin messages.
Check empty/error/pending/success states and mobile readability. Name actions on
buttons and give a next step after errors. Preserve formal roles, financial,
legal and security meaning. These are review candidates, not a claim that every
area has a defect. No site-wide wording rewrite is included in this auth stage.
