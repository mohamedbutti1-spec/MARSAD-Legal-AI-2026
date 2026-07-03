# منصة البحث القانوني — Legal Research Platform

نظام بحث قانوني متكامل مدعوم بالذكاء الاصطناعي للمقارنة بين قانون الإمارات وفرنسا.  
An AI-powered legal research platform for UAE-France comparative law, built for محمد الشامسي.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API server (port auto-assigned)
- `pnpm --filter @workspace/legal-research run dev` — Frontend (port auto-assigned)
- `pnpm run typecheck` — Full typecheck across all packages
- `pnpm run build` — Typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — Regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — Push DB schema changes (dev only)

## Required Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (auto-provided by Replit)
- `ANTHROPIC_API_KEY` — Anthropic API key (secret — never exposed to browser)
- `SESSION_SECRET` — Session signing secret

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 18 + Vite + TanStack Query + Wouter + Tailwind CSS
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- AI: Anthropic Claude (claude-opus-4-5) — server-side only
- File uploads: Multer (PDF / DOCX / TXT)
- Export: XLSX
- Validation: Zod (zod/v4), drizzle-zod
- API codegen: Orval (from OpenAPI spec)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI 3.1 spec (single source of truth)
- `lib/db/src/schema/` — Drizzle ORM table definitions (documents, users, comparisons, comments, settings)
- `artifacts/api-server/src/routes/` — Express route handlers (documents, ai, citations, comparisons, comments, users, settings, export)
- `artifacts/api-server/src/middlewares/roleAuth.ts` — Role-based access control middleware
- `artifacts/legal-research/src/` — React frontend
- `uploads/` — Uploaded files (PDF/DOCX/TXT)
- `exports/` — Generated Excel exports

## Architecture decisions

- ANTHROPIC_API_KEY is **server-side only** — AI routes call Anthropic from Express, never from the browser
- Role-based auth uses `X-User-Role` header (from localStorage in frontend). Replace with JWT/session for production
- File uploads handled by Multer directly — not in OpenAPI spec (binary multipart not supported by codegen)
- Export returns JSON `{ downloadUrl, filename }` — client fetches the download URL separately
- Roles: owner (محمد الشامسي) / supervisor / viewer — seeded automatically on first start

## Product

- Document library: upload and index PDF, DOCX, TXT files
- AI Smart Search: Claude searches across uploaded documents
- Literature Review Generator: Claude generates academic reviews from documents
- UAE-France Legal Comparison: side-by-side AI analysis of both legal systems
- Harvard Citation Generator
- Manual comparison tables (structured rows: aspect / UAE / France)
- Excel export for documents and comparisons
- Admin panel: user management and platform settings

## User preferences

- Owner: محمد الشامسي (m.alshamsi@legal.ae)
- UI is bilingual Arabic/English
- AI features must never expose the API key to the frontend

## Gotchas

- Always run `pnpm run typecheck:libs` before leaf package checks when changing `lib/*` packages
- After OpenAPI spec changes, run codegen before touching frontend or backend imports
- The `/api/documents/upload` endpoint is NOT in the OpenAPI spec — handle with raw `fetch()` from the frontend
- Role middleware reads `X-User-Role` header; frontend must send this header with every request

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- Full deployment instructions in README.md
