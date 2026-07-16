# Behaviors — https://example.com

Findings from the mandatory interaction sweep (run in headless Chromium against the
local reproduction; see provenance note in PAGE_TOPOLOGY.md).

## Scroll sweep
- Page is **not scrollable** at 1440×900, 768×1024, or 390×844 (content height 252.875px desktop / 271.875px mobile).
- No scroll-triggered header changes, no in-view animations, no scroll-snap, no parallax.
- No smooth-scroll library (no `.lenis`, no `.locomotive-scroll`, zero `<script>` tags on the page).

## Click sweep
- Exactly one interactive element: the `More information...` link → `https://www.iana.org/domains/example/`.
- No tabs, pills, modals, dropdowns, accordions, or carousels.

## Hover sweep
- Link hover measured before/after: `color` stays `rgb(56, 72, 143)`, `text-decoration` stays `none`.
  The stylesheet styles only `a:link, a:visited` — **no `:hover` rule exists**. Cursor becomes
  `pointer` (default anchor behavior). No transitions defined anywhere.

## Time-driven
- None. No animations, no keyframes, no auto-cycling content.

## Responsive sweep
- **Desktop 1440px:** card fixed at 600px content width, centered, 80px (5em) top/bottom margin.
- **Tablet 768px:** identical to desktop (768 > 700 breakpoint) — card still 600px, centered with 52px auto side margins.
- **Mobile 390px:** `@media (max-width: 700px)` fires — card becomes `width: auto; margin: 0 auto`,
  i.e. full-bleed edge to edge (content width 326px = 390 − 2×32 padding), top margin collapses to 0.
- Single breakpoint: **700px**.
