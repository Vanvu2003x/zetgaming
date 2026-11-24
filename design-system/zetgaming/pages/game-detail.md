# ZetGaming — Game Detail / Top-up Checkout

Page override generated from the `ui-ux-pro-max` recommendations for a dark, cinematic gaming checkout.

## Direction

- Keep the ZetGaming orange as the conversion color; use blue-black surfaces for trust and readability.
- Use the game's real banner as the hero background, with a separate square thumbnail for identity.
- Keep the purchase path linear: player information → package → payment → summary / CTA.
- Use a two-column desktop layout with a compact game switcher and a sticky order summary; collapse to one column on mobile.
- Keep package cards at two columns on phones so the package name and price remain legible.

## Interaction rules

- Minimum 44px target for form controls and primary actions.
- Visible focus ring on fields, package radios, payment methods, and links.
- Use 150–300ms transitions only; no decorative infinite motion.
- Reserve bottom padding for the fixed mobile navigation so the payment CTA and helper text are never covered.
- Respect `prefers-reduced-motion`.

## Visual tokens

- Background: `#07101b` / `#0b1421`
- Surface: `#101d30` / `#132238`
- Border: `#2d4668`
- Brand action: `#ff9b76` → `#ff6048`
- Primary text: `#f3f6fb`
- Secondary text: `#9eafc4`
- Radius: 14–26px, with smaller radii for compact controls

## Avoid

- Purple/pink gradients as the primary brand treatment.
- Tiny package cards with unreadable prices.
- Covering the CTA with fixed bottom navigation.
- Emoji icons or hover-only interactions.
