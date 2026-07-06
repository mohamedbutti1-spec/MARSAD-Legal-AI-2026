---
name: UAT Permission Architecture
description: Lessons from the 30-role UAT — permission model gaps and correct patterns for each route category
---

## The Permission Model After UAT Fixes

### requireAnyRole = 13 roles (all non-citizen)
- Covers: owner, supervisor, viewer, minister, undersecretary, assistant_undersecretary, director_general, department_director, legal_department, constitutional_reviewer, internal_auditor, external_auditor, judge
- Excludes: citizen (citizen uses legal-os portal, not the AI/research tools)
- Use for: AI tools (JRE, JDC, SPG, PGF), KB search, research workspace, ADKG reads, decision reads

### requireSupervisorOrOwner = 2 roles (owner, supervisor)
- Use for: creating/editing administrative decisions, AI-assist on stages, JDP/CAR generation, stage validation/completion, DCI amendments

### canUseAi (frontend) = role !== 'citizen'
- Controls sidebar AI tools visibility, RouteGuard for AI pages
- Use for: route guards on /jre, /jdc, /spg, /pgf, /kb-search, /workspace, /adkg, /decisions (list), /decisions/:id

### canCreateDecision (frontend) = owner|supervisor
- Controls "New Decision" button visibility and /decisions/new route guard
- Use for: RouteGuard on /decisions/new; conditional rendering of creation buttons

## Common Mistakes to Avoid

**IDOR safety**: workspace/KB/ADKG use requireAnyRole but are safe because queries are ownerId-scoped at DB level (assertProjectOwner, assertDecisionOwner patterns).

**Route guard must match semantic**: /decisions/:id is VIEW (canUseAi), /decisions/new is CREATE (canCreateDecision). Never gate a view route with a create permission.

**Bare routes are a leak**: any Route in App.tsx without RouteGuard is accessible to all roles including citizen. Check new routes get a guard.

**Decision mutation endpoints**: any POST/PUT that modifies a decision record must use requireSupervisorOrOwner. GET reads use requireAnyRole.

**requireGovernanceRead = requireAnyRole** (alias for backwards compat). Safe for read-only taxonomy endpoints. Do not use for write endpoints.

**Why:** UAT revealed 12/14 roles got 403 on all AI routes because requireAnyRole was originally only 3 roles. The governance roles were added in Phase 2 but no one updated requireAnyRole to include them.
