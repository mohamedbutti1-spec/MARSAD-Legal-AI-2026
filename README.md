# منصة البحث القانوني — Legal Research Platform

نظام بحث قانوني متكامل يدعم الذكاء الاصطناعي للمقارنة بين قانون الإمارات وفرنسا.

A full-stack AI-powered legal research platform for UAE-France comparative law analysis.

---

## Features

- **AI Smart Search** — Search within uploaded documents using Anthropic Claude
- **Literature Review Generator** — Auto-generate academic literature reviews from documents
- **UAE-France Legal Comparison** — Side-by-side AI analysis of UAE and French law
- **Document Management** — Upload PDF, DOCX, and TXT files with indexing
- **Harvard Citation Generator** — Generate properly formatted citations
- **Manual Comparison Tables** — Create and manage structured comparison tables
- **Excel Export** — Export documents and comparisons to XLSX
- **Role-Based Access Control** — Owner / Supervisor / Viewer permissions
- **Admin Settings** — Control AI features, upload limits, maintenance mode

---

## Architecture

```
.
├── artifacts/
│   ├── api-server/          # Express 5 backend (Node.js 24)
│   └── legal-research/      # React + Vite frontend
├── lib/
│   ├── api-spec/            # OpenAPI 3.1 spec (source of truth)
│   ├── api-client-react/    # Generated React Query hooks
│   ├── api-zod/             # Generated Zod validation schemas
│   └── db/                  # Drizzle ORM + PostgreSQL schema
```

## Tech Stack

- **Frontend**: React 18, Vite, TanStack Query, Wouter, Tailwind CSS
- **Backend**: Express 5, Node.js 24, TypeScript
- **Database**: PostgreSQL + Drizzle ORM
- **AI**: Anthropic Claude (claude-opus-4-5)
- **File Processing**: Multer (PDF/DOCX/TXT upload)
- **Export**: ExcelJS / XLSX

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (auto-provided by Replit) |
| `ANTHROPIC_API_KEY` | Yes (for AI) | Your Anthropic API key — never exposed to the browser |
| `PORT` | Auto | Assigned by Replit infrastructure |
| `SESSION_SECRET` | Yes | Secret for session signing |

---

## Local Development

### Prerequisites

- Node.js 24+
- pnpm 9+
- PostgreSQL database

### Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd legal-research-platform

# Install all dependencies
pnpm install

# Set environment variables
cp .env.example .env
# Edit .env with your values

# Push database schema
pnpm --filter @workspace/db run push

# Start API server (in one terminal)
pnpm --filter @workspace/api-server run dev

# Start frontend (in another terminal)
pnpm --filter @workspace/legal-research run dev
```

The API server runs on the port defined in your `.env` (default 5000).
The frontend dev server runs on a separate port.

### Regenerate API types after spec changes

```bash
pnpm --filter @workspace/api-spec run codegen
```

---

## API Endpoints

### Documents
| Method | Path | Description |
|---|---|---|
| GET | `/api/documents` | List all documents (supports `?search=` and `?type=`) |
| GET | `/api/documents/:id` | Get a single document |
| GET | `/api/documents/stats` | Get statistics (total, by type, size) |
| POST | `/api/documents/upload` | Upload a file (multipart/form-data) |
| DELETE | `/api/documents/:id` | Delete a document |

### AI Features (require ANTHROPIC_API_KEY)
| Method | Path | Description |
|---|---|---|
| POST | `/api/ai/search` | Smart search across documents |
| POST | `/api/ai/literature-review` | Generate literature review |
| POST | `/api/ai/uae-france-compare` | UAE-France legal comparison |

### Other
| Method | Path | Description |
|---|---|---|
| POST | `/api/citations` | Generate Harvard citation |
| GET/POST | `/api/comparisons` | List / create comparison tables |
| PATCH/DELETE | `/api/comparisons/:id` | Update / delete comparison |
| GET/POST | `/api/comments` | List / add comments to a document |
| DELETE | `/api/comments/:id` | Delete a comment |
| GET/POST | `/api/users` | List / create users (admin) |
| PATCH/DELETE | `/api/users/:id` | Update / delete user (admin) |
| GET/PATCH | `/api/settings` | Get / update admin settings (owner) |
| POST | `/api/export` | Export to Excel |

---

## Permissions

| Role | Permissions |
|---|---|
| **owner** | Full access — documents, AI, comparisons, citations, users, settings |
| **supervisor** | Upload docs, use AI features, comment, manage comparisons — NO users/settings |
| **viewer** | Read-only — view documents and comparisons only |

The owner account is pre-seeded: **محمد الشامسي** (m.alshamsi@legal.ae)

---

## Deployment

### Replit (recommended)

1. Open the project on [replit.com](https://replit.com)
2. Add `ANTHROPIC_API_KEY` as a Secret in the Replit Secrets panel
3. Click **Publish** — Replit handles database migrations, CDN, and SSL automatically

### Vercel (frontend only)

```bash
cd artifacts/legal-research
pnpm build
vercel deploy dist/
```

Set environment variables in Vercel dashboard. The backend must be deployed separately (Railway or similar).

### Railway (backend)

```bash
# From the repo root
railway init
railway add --service api-server
railway variables set ANTHROPIC_API_KEY=your_key
railway up
```

Set `DATABASE_URL` to your Railway PostgreSQL connection string.

### Docker (self-hosted)

```bash
# Build the API server
docker build -f Dockerfile.api -t legal-research-api .

# Run
docker run -p 5000:5000 \
  -e DATABASE_URL=postgres://... \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -e SESSION_SECRET=your-secret \
  legal-research-api
```

---

## Connecting Your Existing pplx.app Frontend

If you have an existing frontend on pplx.app, update API calls to point to your deployed backend:

```javascript
// Replace all API calls base URL
const API_BASE = "https://your-backend.railway.app/api";

// Example: AI Search
const result = await fetch(`${API_BASE}/ai/search`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ query: "...", documentIds: [] }),
});
```

The API is CORS-enabled and returns standard JSON responses.

---

## Security Notes

- `ANTHROPIC_API_KEY` is **never** sent to the browser — all AI calls are server-side
- File uploads are stored on the server filesystem (configure cloud storage for production)
- Role-based access is enforced per-request on the backend
- All inputs are validated with Zod schemas generated from the OpenAPI spec

---

## Development Commands

```bash
pnpm run typecheck            # Full TypeScript check
pnpm run build                # Build all packages
pnpm --filter @workspace/api-spec run codegen    # Regen API client
pnpm --filter @workspace/db run push             # Push DB schema changes
pnpm --filter @workspace/db run push-force       # Force push (destructive)
```
