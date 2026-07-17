---
name: Judicial Command Center visual rebuild
description: Dark judicial palette rebuild of MARSAD legal-research frontend — token strategy, sweep approach, gating pattern
---

Full UX/visual rebuild to a fixed dark "federal judicial command center" theme (navy/gold/blue-heading, no light/dark toggle).

- All Tailwind literal color-family classes (`amber-*`, `orange-*`, `yellow-*`, `green-*`) were swept repo-wide via scripted perl regex (shade→opacity mapping onto the new `gold` / `heading` custom color tokens) rather than hand-editing each of the ~55 affected files — much faster and consistent than manual edits for a global rebrand.
- **Why:** hardcoded Tailwind palette classes don't respond to CSS custom-property/theme changes, so redefining `index.css` tokens alone leaves every literal `bg-amber-500` etc. still rendering the old (forbidden) color.
- **How to apply:** for any future global color-family rebrand, grep for the literal Tailwind color prefixes first — CSS variable changes alone are insufficient. Watch for double-opacity artifacts (`gold/80/20`) when a shade-to-token mapping adds its own `/NN` suffix onto a class that already had one; collapse with a second regex pass keeping the last (explicit) opacity.
- Semantic mapping used: success/positive → heading-blue token, warning/caution → gold token, destructive/critical → existing danger-red token (left untouched).
- Owner-only page gating (`/naip`, `/naip/kpi`, `/constitutional-intelligence`) was changed from broader permission flags to an explicit `role === 'owner'` check at both nav-visibility and page-guard level — a deliberate access-narrowing change, not just a nav-hide.
- Assistant page's guided config (role / jurisdiction / answer-mode selectors) already existed via `PreAnalysisPanel` (shown pre-session) and `SessionConfigBar` (compact summary once committed) — reused instead of building a new toolbar; only had to add an "answer mode" chip section since role+jurisdiction already existed.

## Completion pass (July 2026)
- Second sweep converted the families the first pass skipped — red/rose→destructive, blue/sky/indigo/cyan/violet/purple/emerald/teal/lime→heading, slate/gray/zinc→muted/card/border/foreground, solid `bg-white`→`bg-card` — plus the header (was still `bg-white` with light tier chips).
- Arbitrary-value hex classes (`bg-[#00563F]`, `bg-[#1e3a5f]`, `text-[#C9A84C]`, light `#F5F6FA`/gradient page backgrounds) existed on citizen-portal, ADKG, workspace, governance-hub, shamsi-theory and dialogs — regex sweeps for Tailwind families miss these; grep `\[#` too.
- `.dark` is never applied to the DOM (only `<meta color-scheme>`), so `dark:` variant classes are dead code; base classes always win.
