---
name: Sidebar nav restoration + secondary hardening pass
description: Restoring intentionally-hidden nav items, route dedup pattern, and truncation-transparency principle used across MARSAD
---

- Sidebar had an explicit code comment block listing pages deliberately removed from navigation only (routes/permissions untouched) during an earlier visual rebuild. Always check for such a block before assuming a missing nav link is an oversight — restoring it just means re-adding `NavItem` entries with the *existing* permission flag (e.g. `canViewGovernanceDashboard`, `canUseShamsiFramework`), never inventing new gating.
- Route dedup pattern used: keep the older/duplicate page component file intact (no deletion), turn its route into `<Route path="/old"><Redirect to="/canonical" /></Route>` — preserves old URLs/bookmarks while removing the duplicate from the sidebar.
- Silent AI-response repair (e.g. truncated-JSON auto-patching) must always surface a `somethingRepaired: boolean` flag through to the API response and render an explicit warning banner in the UI — never let "we fixed it silently" be the whole story for an AI legal-analysis output.
- Tailwind literal-color → CSS-token sweep via perl regex: when the light-mode class you're mapping already carries its own `/NN` opacity suffix (e.g. `bg-emerald-50/60`), a naive `s/bg-emerald-50/bg-emerald-500\/10/` produces a broken double-opacity class (`bg-emerald-500/10/60`). Always run a second cleanup pass collapsing `token/NN/MM` → `token/MM` (keep the last, explicit opacity) — confirms the same failure mode already logged in judicial-command-center-theme.md is not a one-off.
