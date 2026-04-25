# CodeReviewer

Automated AI-powered code review for GitHub repositories. Static analysis + LLM review, delivered as an actionable report in under 3 minutes.

> **Live demo:** https://codereviewer-web.vercel.app

![Report page screenshot](docs/screenshot-report.png)

## What it does

Connect your GitHub account, pick a repository, and get a detailed code review in ~2 minutes:

- **Security issues** — SQL injection, XSS, hardcoded secrets, unsafe `eval` (ESLint-security + Semgrep OWASP rulesets + Gemini)
- **Performance bugs** — N+1 queries, unnecessary re-renders, O(n²) where O(n) works (Gemini full-file context)
- **Code quality** — dead code, high complexity, missing error handling
- **AI-written fix suggestions** with code examples for every issue

Scored 0–100 overall, plus per-category scores for Security / Performance / Quality. Export the full report as a PDF.

---

## Tech stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React 18 · TypeScript · Vite · Tailwind CSS · React Query · `@react-pdf/renderer` |
| Backend | Node.js 20 · Express · TypeScript · Prisma · PostgreSQL 16 |
| Queue | BullMQ · Redis (Upstash) |
| Analysis | ESLint 8 (programmatic) · Pylint 3 · Semgrep (OWASP + secrets rulesets) · Gemini 2.5 Flash Lite |
| Auth | GitHub OAuth · JWT (httpOnly cookie) · AES-256-GCM token encryption |
| Infra | Turborepo monorepo · Docker · Render (API) · Vercel (web) |
| Real-time | Server-Sent Events over Redis pub/sub |

---

## Architecture decisions

**BullMQ + Redis, not in-request processing** — Analyses take 1–3 minutes; Render's free tier kills HTTP requests at 30 s. The queue survives cold starts and enables auto-retry with exponential backoff.

**SSE, not WebSocket** — Progress is one-way. SSE is plain HTTP, works through proxies, and `EventSource` reconnects automatically. Auth just works via cookies.

**Gemini Flash Lite, not GPT-4/Claude** — The free tier (15 RPM) covers demo load comfortably. The product costs $0/month to run.

**Denormalized issue counts on `Analysis`** — Dashboard loads in a single indexed query with no joins.

**AES-256-GCM for GitHub tokens** — `repo` scope grants write access to every private repo. A DB leak must not equal full compromise.

---

## Local development

```bash
# Prerequisites: Node 20, pnpm, Docker
pnpm install
docker compose up -d            # Postgres 16 + Redis 7

cp apps/api/.env.example apps/api/.env      # fill in secrets
cp apps/web/.env.example apps/web/.env

pnpm --filter @cr/api exec prisma migrate dev --name init
pnpm dev
```

Open http://localhost:5173

### Required environment variables (`apps/api/.env`)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Postgres connection string |
| `REDIS_URL` | Redis URL (`redis://localhost:6379` locally) |
| `JWT_SECRET` | 64+ byte random hex string |
| `TOKEN_ENCRYPTION_KEY` | 32 bytes as base64 (44 chars) |
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret |
| `GITHUB_CALLBACK_URL` | `http://localhost:8080/api/auth/github/callback` |
| `GEMINI_API_KEY` | From https://aistudio.google.com/app/apikey |
| `FRONTEND_URL` | `http://localhost:5173` |

Generate secrets:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"   # JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" # TOKEN_ENCRYPTION_KEY
```

---

## Running tests

```bash
pnpm --filter @cr/api test
```

Unit tests cover the scoring formula and GitHub file-filter logic. Integration tests require a live DB (skip for local dev with `--run`).

---

## Deployment

See [Section 12 in PLAN.md](PLAN.md) for step-by-step instructions for:
- Postgres on Render Free
- Redis on Upstash Free
- API on Render (Docker)
- Web on Vercel

---

## Free-tier constraints

| Service | Limit | Impact |
|---------|-------|--------|
| Render web service | Spins down after 15 min idle | ~30 s cold start on first request |
| Render Postgres | Deleted after 90 days | Export monthly backup |
| Upstash Redis | 10 000 commands/day | ~333 analyses/day maximum |
| Gemini Flash Lite | 15 RPM free | `p-limit(2)` + backoff keeps us well under |

---

## Resume bullet

> **CodeReviewer** — Built and deployed an AI-powered code review SaaS. Full-stack TypeScript (React 18 / Node.js), PostgreSQL, BullMQ queue, Gemini 2.5 LLM. AES-256-GCM OAuth token storage, Server-Sent Events for real-time progress, containerised deploy on Render free tier. End-to-end in 5 days with AI-assisted development.
