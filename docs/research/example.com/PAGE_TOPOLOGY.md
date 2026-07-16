# Page Topology — https://example.com

> **Provenance note:** the live site was unreachable from this session — the environment's
> egress network policy returned `403` on CONNECT to `example.com:443` (container proxy) and
> WebFetch was also denied. The page was reconstructed from the canonical, long-stable
> example.com markup (fully self-contained: inline CSS, no scripts, no images), and every
> computed-style value below was measured with `getComputedStyle()` in headless Chromium
> against the local reproduction at `clones/example.com/index.html`.

## Sections (top to bottom)

| # | Working name | Type | Interaction model |
|---|--------------|------|-------------------|
| 1 | `example-domain-card` | Flow content (only section on page) | static |

That's the whole page: one centered card on a flat background. No header, no footer,
no fixed/sticky overlays, no z-index layers.

## Page layout

- Scroll container: none needed — page fits in every tested viewport (page height 252.875px
  at 1440px wide; not scrollable at 1440/768/390).
- Column structure: single column; card centered via `margin: 5em auto` on a fixed
  `width: 600px` block.
- Layers: single layer, `position: static` everywhere.
- Dependencies between sections: none (single section).

## Global tokens

- Page background: `rgb(240, 240, 242)` (`#f0f0f2`)
- Card background: `rgb(253, 253, 255)` (`#fdfdff`)
- Link color: `rgb(56, 72, 143)` (`#38488f`)
- Text color: `rgb(0, 0, 0)`
- Font stack: `-apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", "Open Sans", "Helvetica Neue", Helvetica, Arial, sans-serif` (system fonts only — nothing to download)
- Assets: **zero.** No images, no videos, no SVGs, no favicons served, no external CSS/JS.

## Assembly

Single self-contained document: `clones/example.com/index.html`. No framework required.
