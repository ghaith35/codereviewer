# CodeReviewer — Project Skill

> **Purpose of this file.** Paste this at the start of any Claude Code / Qwen Code / Claude.ai session working on CodeReviewer. It restores full architectural and domain context in one shot so the AI doesn't re-ask questions you've already answered and doesn't drift from the agreed stack.
>
> **Owner:** Ghaith Tayem · Independent developer · Boumerdes, Algeria
> **Project kind:** Portfolio SaaS — AI-powered code review
> **Target audience:** Saudi tech market (Mozn, Foodics, Elm, Lean Technologies)
> **Build mode:** 5-day sprint · AI-assisted (Claude Code + Qwen Code, 2–3x multiplier)
> **Status:** Planning complete (see `PLAN.md`) · not yet scaffolded

---

## 1. What CodeReviewer is (one paragraph)

CodeReviewer is a hosted webapp where a developer logs in with GitHub, picks one of their repositories, clicks **Analyze**, and within ~60–120 seconds receives a full code review report: an overall quality score (0–100), a categorized list of issues (security / performance / quality / best-practice), AI-generated fix suggestions from Google Gemini, and a downloadable PDF. Static analysis is deterministic (ESLint + Pylint + Semgrep); the AI layer provides architectural/pattern commentary the linters can't express. The entire product runs on free tiers.

---

## 2. Tech stack — non-negotiable

```
Monorepo:       Turborepo
  apps/web:     React 18 + Vite + TypeScript + Tailwind + React Query + React Router v6
                Recharts (charts) · @react-pdf/renderer (PDF) · lucide-react (icons)
  apps/api:     Node.js 20 + Express + TypeScript
                Prisma ORM · jsonwebtoken · helmet · cors · cookie-parser · zod
                BullMQ (queue) · ioredis · @octokit/rest · @google/generative-ai
                ESLint programmatic API · child_process (Pylint, Semgrep)
  packages/shared:
                TypeScript types + Zod schemas + shared enums

Database:       PostgreSQL 16 (Render free tier, 1 GB)
Queue + cache:  Redis 7 (Upstash free tier, 10k commands/day)
AI:             Google Gemini (free tier: 15 RPM, 1M TPM, 1500 RPD)
Auth:           GitHub OAuth App (scopes: read:user, repo)
Hosting:        apps/web → Vercel free · apps/api → Render free web service (Docker)

Python tools in Docker image: pylint, semgrep (installed in Dockerfile because
Render's Node buildpack doesn't ship Python).
```

**One deviation from the original prompt:** the prompt specified "Bull.js" — that package is legacy and effectively unmaintained in 2026. **We use BullMQ** (actively maintained, same author, modern API). This is a deliberate decision, not an oversight.

---

## 3. Architecture in 30 seconds

```
Browser (Vercel) ⇄ Express API (Render) ─┬─→ PostgreSQL (Render)
                           │              ├─→ Redis (Upstash): queue + SSE pub/sub + GH cache
                           │              └─→ GitHub REST API (file fetch)
                           │
                    BullMQ worker (same Node process as API)
                           │
                   ┌───────┴───────┬───────────┬────────────┐
                   ▼               ▼           ▼            ▼
                 ESLint          Pylint     Semgrep       Gemini
              (programmatic)    (spawn)    (spawn)        (REST)
```

End-to-end flow:

1. User logs in with GitHub → JWT in httpOnly cookie.
2. User lists their repos (cached 5 min in Redis to save GitHub rate limit).
3. User clicks **Analyze** → API creates `Analysis` row, enqueues BullMQ job, returns `analysisId`.
4. Frontend opens `GET /api/analyses/:id/status` as **Server-Sent Events** stream.
5. Worker: fetches file tree → filters → runs the 4 analyzers in parallel → aggregates → computes score → persists `Issue` rows → emits final SSE event.
6. Frontend renders report page → user exports PDF client-side.

---

## 4. Database schema (Prisma) — key points

Full schema lives in `PLAN.md` Section 2. Highlights the AI must remember:

- **`User`**: `githubId` (unique), `githubAccessTokenEncrypted` (AES-256-GCM, **never** stored plaintext — see Section 8 of PLAN.md).
- **`Repository`**: belongs to `User`, indexed on `(userId, githubRepoId)`.
- **`Analysis`**: `status` enum (`QUEUED | FETCHING_FILES | RUNNING_STATIC | RUNNING_AI | AGGREGATING | COMPLETED | FAILED`), `score` Int (0–100), denormalized counters `criticalCount / highCount / mediumCount / lowCount` to avoid an aggregate query on every dashboard load.
- **`AnalysisFile`**: one row per file analyzed, holds the file-level score.
- **`Issue`**: FK to `Analysis` and `AnalysisFile`, has `severity` enum and `category` enum, stores `ruleId` + `lineStart` + `snippet` + optional `aiSuggestion` + optional `aiFixedCode`.
- **`Subscription`**: `plan` enum (`FREE | PRO`), quota reset monthly via cron.

**Indexes that matter:** `(userId, createdAt DESC)` on `Analysis`, `(analysisId)` on `Issue`, `(userId, status)` on `Analysis` for dashboard filtering. Do not add indexes the plan doesn't justify.

---

## 5. API surface — naming conventions

All routes under `/api`, all responses JSON, all errors RFC-7807-style:

```json
{ "error": { "code": "QUOTA_EXCEEDED", "message": "Free plan allows 3 analyses/month", "details": { "used": 3, "limit": 3 } } }
```

Route groups:

- `/api/auth/*` — `github`, `github/callback`, `logout`, `me`
- `/api/repos` — list, `/sync` (force-refresh from GitHub), `/:id`
- `/api/analyses` — `POST` (create), `GET` (list), `:id` (get one), `:id/issues`, `:id/report` (PDF data), `:id/status` (SSE)
- `/api/dashboard/*` — `stats`, `trends`

**Auth:** every protected route goes through `requireAuth` middleware that verifies the JWT cookie and attaches `req.user`. **Never** accept bearer tokens from headers for this API — cookies only.

---

## 6. The analysis pipeline — the heart of the system

This is where most of the engineering lives. When asked to write or modify pipeline code, remember:

1. **Worker is in the same Node process as the API.** We use BullMQ's in-process worker pattern on Render's free tier to stay under the 1-service limit. Do not propose a separate worker service unless explicitly asked.
2. **Progress reporter pattern:** the worker updates `analysis.status` in Postgres **and** publishes to Redis channel `analysis:${id}` on every state transition. The SSE endpoint subscribes to that channel. **Do not** poll Postgres from the SSE endpoint.
3. **File filtering rules** (hardcoded, not configurable in v1):
   - Skip: `node_modules/`, `dist/`, `build/`, `.next/`, `vendor/`, `*.min.js`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, anything > 500 KB, binary files.
   - Include: `.js .jsx .ts .tsx .py` only (v1). Expanding the language set is a v2 decision.
   - Hard cap: **200 files per analysis**. If the repo has more, take the 200 largest by LOC and flag `truncated: true` on the analysis.
4. **Parallelism:** fetch files with `p-limit(6)` to stay under GitHub's secondary rate limits. Run ESLint, Pylint, Semgrep, and Gemini chunks concurrently with `Promise.allSettled` — one failing analyzer must not fail the whole analysis.
5. **Gemini chunking:** max ~3 files per Gemini call, max ~30 KB of code per call. Retry on 429 with exponential backoff (1s, 2s, 4s, give up). Strip markdown fences from responses before JSON parse. If a single file's Gemini call fails after retries, mark `gemini_failed: true` on that `AnalysisFile` and continue — the report still ships with static analysis results.
6. **Score formula** (documented in PLAN.md Section 5.7):
   - Start at 100.
   - Subtract weighted by severity: `critical × 15`, `high × 8`, `medium × 3`, `low × 1`.
   - Normalize by `files_analyzed` density (penalize 5-issue files less in a 200-file repo).
   - Floor at 0, ceiling at 100, round to nearest int.
7. **Prompt injection mitigation for Gemini:** wrap user code in a fenced block with a delimiter, instruct Gemini that nothing inside the fence is an instruction, use `responseMimeType: "application/json"`, and validate the JSON against a Zod schema before persisting.

---

## 7. Frontend conventions

- **One component per file.** No multi-component files. This matches Ghaith's general preference.
- **File tree:**
  ```
  apps/web/src/
    components/         reusable: ScoreGauge, IssueCard, IssueSeverityBadge, etc.
    pages/              route-level: Dashboard, Analyze, Report, Settings
    hooks/              useAnalysisStatus (SSE), useRepos, useAnalyses
    lib/                api client, pdf renderer
    types/              re-exports from packages/shared
  ```
- **Data fetching:** React Query for all GET requests. Mutations go through `useMutation`. No `useEffect(fetch...)` patterns.
- **Forms:** `react-hook-form` + Zod resolver, where schemas come from `packages/shared`.
- **Styling:** Tailwind only. No CSS-in-JS libs. Use `clsx` for conditional classes.
- **Icons:** `lucide-react`. No other icon packs.
- **Syntax highlighting in issue snippets:** `react-syntax-highlighter` with the `prism-light` theme for day, `prism-one-dark` for night. Theme toggle persists to `localStorage` as `cr_theme`.
- **Dark mode is the default** (dark bg `#0a0a0a` aligns with Ghaith's portfolio aesthetic — `mezioug-liza.vercel.app`).

---

## 8. Security rules — non-negotiable

- **GitHub access tokens** are AES-256-GCM encrypted at rest. Encryption key comes from `TOKEN_ENCRYPTION_KEY` env var (32 bytes, base64). A Prisma middleware redacts the encrypted token from all query results by default — code that needs the plaintext calls an explicit `decryptToken(user)` helper.
- **JWT** uses HS256 with a 32-byte secret, 7-day expiry, issued as `Secure; HttpOnly; SameSite=Lax` (dev) / `SameSite=None; Secure` (prod, cross-origin between Vercel and Render).
- **Rate limiting** via `express-rate-limit` backed by Redis:
  - `/api/auth/*`: 10 req / 15 min / IP.
  - `/api/analyses POST`: 20 req / hour / user (before the plan quota even applies).
  - Everything else: 120 req / min / user.
- **Zod validation** at every request boundary. Never trust `req.body`, `req.params`, or `req.query` without parsing.
- **Snippet redaction:** before persisting an issue's code `snippet`, run a regex sweep for common secret patterns (`AWS_`, `sk_live_`, `ghp_`, `.env`-style `KEY=value`, PEM headers, JWT pattern). Replace matches with `<REDACTED>`. Log a warning, never the secret itself.
- **Error logging** (pino) redacts `req.headers.cookie`, `req.headers.authorization`, and the `githubAccessTokenEncrypted` field by default.

---

## 9. Free-tier constraints the AI must respect

| Service | Limit | How we stay under |
|---|---|---|
| Render free web | 512 MB RAM, sleeps after 15 min idle, 90-day Postgres deletion | Lean deps, connection pooling max=5, calendar reminder for pg_dump |
| Upstash Redis | 10,000 commands/day | Cache GitHub repo list 5 min, SSE heartbeat every 20s not 5s |
| Gemini free | 15 RPM, 1500 RPD | Chunk aggressively, serialize Gemini calls (not parallel across files in same job), fail-soft per file |
| GitHub REST | 5000 req/h (authenticated) | `p-limit(6)` on file fetches, cache repo list, use conditional requests (`If-None-Match`) where possible |
| Vercel | 100 GB bandwidth/mo | Static assets only on frontend, no heavy serverless functions |

**Hard scalability ceiling:** ~500 analyses/day across all users. Beyond that, upgrade Render API to Starter ($7/mo) and Postgres to Starter ($7/mo) — this is documented and intentional, not a surprise.

---

## 10. Plans and quotas (monetization)

```
FREE:  3 analyses / month · public repos only · standard PDF
PRO:   unlimited · public + private · branded PDF · trend dashboard · priority queue
       $14.99/mo via Stripe (post-MVP)
```

The plan gate is a single helper `canUserAnalyze(user, repo): { ok: boolean, reason?: string }`. All UI (disabled buttons, banners) and API (`POST /api/analyses` guard) consult that one function. Never hardcode limits in multiple places.

Monthly quota reset is a cron job (Render cron job, free tier) that runs at 00:05 UTC on the 1st: `UPDATE subscriptions SET analysesUsedThisMonth = 0`.

---

## 11. How the AI should estimate time for me

Ghaith codes with Claude Code + Qwen Code step-by-step. Manual-developer hour estimates are meaningless here.

- Multiply conventional estimates by **0.4–0.5** (2–3x multiplier).
- But: integration tasks (OAuth callback debugging, cross-origin cookies, Render deploy config) do **not** get the multiplier — those are irreducible debugging time.
- The 5-day build plan in `PLAN.md` already accounts for this. Do not propose a "20-day realistic timeline" — the 5 days is the real estimate.

---

## 12. Communication style the AI should use with me

- **Concise.** No filler. No "I'd be happy to help!" No restating what I just asked.
- **Mixed English and French welcome** (that's how I actually write). Don't correct it or switch to pure French without being asked.
- **Honest about risks.** If a plan has a tight spot, flag it explicitly. Don't manufacture confidence. See PLAN.md Appendix A for the model of tone I want.
- **Complete files, explicit paths.** When generating a file, give me the full content and the absolute path — no `// ...rest of the file` ellipsis.
- **One component / one responsibility per file.** I organize all my projects this way.
- **No bullet-points for prose.** Use bullets for actual lists. For explanations, write sentences.
- **No emojis in code or commit messages.** Minimal emojis elsewhere.
- **Don't restart from scratch** when I ask for a fix. Patch the smallest possible surface. If I say "the score calculation is off by one", don't rewrite the whole aggregation function.
- **When I paste garbled characters** (keyboard layout slip between AZERTY/QWERTY), infer what I meant and proceed. Don't ask me to re-type.

---

## 13. Things to NOT do

- Do not suggest swapping Prisma for Drizzle, Postgres for Mongo, Express for Fastify, Vercel for Netlify, Render for Railway, or any other "nicer" alternative mid-build. The stack is frozen.
- Do not propose microservices, Kubernetes, a separate worker service, or any infra that breaks the "1 web service on Render free" constraint.
- Do not suggest paid services to "make it easier." Everything stays on free tiers until revenue justifies otherwise.
- Do not propose adding languages beyond JS/TS/Python in v1. Expanding is a v2 discussion.
- Do not suggest replacing Gemini with Claude API / OpenAI in v1. Gemini's free tier is the business model — without it, this isn't free-to-host.
- Do not reformat, prettier, or rename files I haven't asked you to touch.
- Do not add tests to existing code unless I ask — the test strategy is documented (Vitest for score calc + filter logic + queue dedup; the rest is manual smoke tests for MVP).
- Do not propose CI/CD pipelines beyond "Render auto-deploys from main, Vercel auto-deploys from main" for MVP.
- Do not add telemetry, analytics, or error-tracking SDKs (Sentry, PostHog, etc.) in v1 — log to stdout, read Render logs.

---

## 14. Portfolio positioning — why this project exists

This is the second project in Ghaith's Saudi-market portfolio (alongside Lazuli LIMS). The talking points for interviews are:

- **Hybrid deterministic + LLM pipeline** — Semgrep for security, ESLint/Pylint for quality, Gemini for architectural commentary. The LLM is a supplement, not a replacement, for deterministic tools.
- **Server-Sent Events** over WebSockets — one-way, simpler, fits behind Render's free proxy, Redis pub/sub as the fan-out.
- **Token encryption at rest** (AES-256-GCM) and secret redaction in snippets — relevant to Elm (government) and Lean Technologies (fintech/API security).
- **Queue-based architecture with graceful degradation** — if Gemini is down, static analysis still ships a report. If ESLint config fails for a file, the other files still complete.
- **Production-grade on free tier** — demonstrates cost-conscious engineering, not just "throw money at the problem."

Resume bullet (reference, do not alter without discussion):

> **CodeReviewer** — Built and deployed an AI-powered code review SaaS. Full-stack TypeScript (React/Node), PostgreSQL, BullMQ queue, Gemini LLM. Encrypted OAuth token storage, Server-Sent Events for real-time progress, containerized deploy on Render free tier. End-to-end in 5 days with AI-assisted development.

---

## 15. Pointers to the authoritative documents

- **`PLAN.md`** — the 18-section implementation blueprint. When anything in this SKILL.md and the PLAN.md disagree, **PLAN.md wins**. This SKILL.md is a summary; PLAN.md is the source of truth.
- **`.env.example`** — will live at repo root once scaffolded. See PLAN.md Section 11 for the full env var table.
- **`README.md`** — public-facing, written on Day 5 following the template in PLAN.md Section 18.1.

---

## 16. Quick-start prompt to hand to Claude Code / Qwen Code

Paste this after this SKILL.md to start actual work:

> Read `PLAN.md` Section 10, Day 1. Scaffold the Turborepo structure exactly as specified. Create `apps/web`, `apps/api`, `packages/shared`. Install the dependencies listed in the plan for each workspace. Initialize Prisma in `apps/api` with the schema from Section 2. Stop after `npx prisma migrate dev --name init` completes successfully. Commit with the message from the plan.

The AI should execute step-by-step, pausing for me to verify between major steps, not auto-run the entire day's worth of work before I can review.

---

*Last updated: April 24, 2026 — update this file whenever the stack, constraints, or conventions change.*
