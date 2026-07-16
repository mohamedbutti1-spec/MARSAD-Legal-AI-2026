# ExampleDomainCard Specification

## Overview
- **Target file:** `clones/example.com/index.html` (single self-contained page — no framework scaffold present in this repo, so the clone is plain HTML/CSS)
- **Screenshots:** `docs/design-references/example.com/desktop-1440.png`, `tablet-768.png`, `mobile-390.png`
- **Interaction model:** static

## DOM Structure
```
body
└── div            (the card — only element on the page)
    ├── h1         "Example Domain"
    ├── p          intro paragraph
    └── p
        └── a      "More information..." → https://www.iana.org/domains/example/
```

## Computed Styles (exact values from getComputedStyle, headless Chromium 1440×900)

### body
- margin: 0px; padding: 0px
- backgroundColor: rgb(240, 240, 242)
- fontFamily: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", "Open Sans", "Helvetica Neue", Helvetica, Arial, sans-serif
- fontSize: 16px; fontWeight: 400; color: rgb(0, 0, 0)

### div (card)
- width: 600px (authored `width: 600px`)
- margin: 80px auto (authored `margin: 5em auto`; resolved side margins 388px at 1440px viewport)
- padding: 32px on all sides (authored `padding: 2em`)
- backgroundColor: rgb(253, 253, 255)
- borderRadius: 8px (authored `0.5em`)
- boxShadow: rgba(0, 0, 0, 0.02) 2px 3px 7px 2px
- display: block; position: static

### h1
- fontSize: 32px; fontWeight: 700; lineHeight: normal (rendered height 38px)
- color: rgb(0, 0, 0)
- margin: 21.44px 0 (UA default `0.67em`)

### p
- fontSize: 16px; fontWeight: 400; color: rgb(0, 0, 0)
- margin: 16px 0 (UA default `1em`)

### a
- color: rgb(56, 72, 143)  (authored `#38488f` on `a:link, a:visited`)
- textDecoration: none
- cursor: pointer

## States & Behaviors
- **Hover (link):** no authored `:hover` rule — color and text-decoration unchanged on hover (measured before/after). N/A beyond default `cursor: pointer`.
- **Scroll / click / time-driven:** N/A — page has zero scripts and no other interactive elements.

## Per-State Content
N/A — single static state.

## Assets
None. No images, videos, SVGs, webfonts, or favicons. System font stack only.

## Text Content (verbatim)
- Title tag: `Example Domain`
- h1: `Example Domain`
- p1: `This domain is for use in illustrative examples in documents. You may use this domain in literature without prior coordination or asking for permission.`
- p2 link: `More information...` → `https://www.iana.org/domains/example/`

## Responsive Behavior
- **Desktop (1440px):** 600px card centered, 80px top/bottom margin.
- **Tablet (768px):** identical — breakpoint not yet reached.
- **Mobile (390px):** card `width: auto; margin: 0 auto` (full-bleed; measured content width 326px, top margin 0).
- **Breakpoint:** exactly 700px (`@media (max-width: 700px)`).

## Provenance
Live `example.com` was unreachable from this session (egress policy 403 on both the
container proxy and WebFetch). Markup reconstructed from the canonical, long-stable
example.com source; all computed values above measured on that reproduction in
headless Chromium. Re-verify against the live site when network policy allows.
