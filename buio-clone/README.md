# BUIO — static clone

A self-contained, pixel-faithful reproduction of the BUIO Web3/SaaS marketing
template (reference: `lexingtonthemes.com/viewports/buio`), rebuilt as plain
HTML + CSS + vanilla JS for study purposes. No framework, no build step to
*view* the site — just open any `.html` file, or serve the folder statically.

## Run it

```
cd buio-clone
python3 -m http.server 8000
# open http://localhost:8000/index.html
```

## Structure

```
buio-clone/
  index.html, pricing.html, blog.html, ...   16 static pages (the deliverable)
  assets/
    css/
      tokens.css     design tokens: color (oklch), type scale, radii, motion
      base.css       reset, typography, buttons, cards, forms, scroll-reveal
      chrome.css     header/footer/nav, mobile menu
      sections.css   per-page section components (hero, pricing, blog, ...)
    js/
      main.js        theme toggle, mobile nav, scroll-reveal, FAQ accordion,
                      pricing toggle, filter chips, TOC scroll-spy
  _build/            dev-time only, not needed to view the site
    partials/        shared head/header/footer HTML
    pages/           per-page body content + <!--META {...}--> front matter
    generate.mjs     stitches partials + pages into the top-level *.html files
```

## Editing pages

Don't hand-edit the top-level `*.html` files' header/footer directly — they're
generated. Edit `_build/pages/<name>.html` (or the shared partials) and re-run:

```
node _build/generate.mjs
```

## Theming

Dark is the default. `[data-theme="light"]` on `<html>` (toggled by the
navbar's theme button, persisted to `localStorage`) swaps every color token
via CSS custom properties in `assets/css/tokens.css` — no component CSS
depends on the theme directly.
