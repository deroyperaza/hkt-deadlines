# Architecture

## Overview

Hyperakt Deadlines is a single-page web app that syncs deadline data from Slack canvases into a live, filterable dashboard. It has no backend server — all logic runs in Firebase Cloud Functions on demand.

```
Slack Canvases → Cloud Functions → Firestore → Web App (live)
```

---

## Frontend

**Stack:** Vanilla HTML/CSS/JS — no framework, no build step, no dependencies.

The entire frontend is a single file: `public/index.html`. It is deployed to Firebase Hosting, which serves it globally via CDN.

**Auth:** Firebase Auth with Google OAuth. Sign-in is restricted to `@hyperakt.com` accounts at two levels:
1. The Google OAuth `hd` parameter limits the sign-in picker to Hyperakt accounts
2. Firestore security rules reject all reads/writes from non-`@hyperakt.com` tokens

**Data:** Firestore collections:
- `deadlines/{id}` — one document per deadline entry
- `projects/{name}` — project metadata and last-sync timestamps
- `updateLog/{id}` — audit log of syncs and completions
- `meta/sync` — global sync status (last synced, deadline count, errors)

The frontend subscribes to Firestore in real time — any change (e.g. a teammate marking a deadline complete) appears instantly without a page refresh.

**Views:**
- **List** — deadlines grouped by month, sortable, filterable
- **Cal** — calendar grid, month by month
- **Plan** — horizontal Gantt timeline (Apr–Dec), one row per project
- **Log** — audit trail of all syncs and completions

**Design system:** CSS custom properties using Hyperakt brand tokens:
- Colors: `--hotsauce` (#ff4d00), `--hubble` (#0f0450), `--horchata` (#fffcf1)
- Fonts: Barlow + Barlow Semi Condensed (Google Fonts)

---

## Backend

**Stack:** Firebase Cloud Functions v2, Node.js 22, deployed to `us-east1`.

Two functions:

### `syncDeadlines` (HTTP)
Triggered by the `/sync-deadlines` Slack slash command. Responds to Slack immediately (< 3s), then runs the full sync asynchronously and posts the result back via Slack's `response_url`.

Config: 540s timeout, 512MiB memory.

### `scheduledSync` (Cron)
Runs automatically every day at **2am ET** via Google Cloud Scheduler (`0 2 * * *`, `America/New_York`).

### Admin endpoints (one-time use, delete after use)
- `clearMassInsight` — clears a project's `canvasUpdatedAt` to force re-parse on next sync
- `renameProject` — deletes all Firestore docs for an old project name so it can be re-synced under a new name

---

## Data Pipeline

### Phase 1 — Connectivity check
An `auth.test` ping to Slack confirms the token is valid before proceeding.

### Phase 2 — Metadata fetch (serialized)
`files.info` is called for each project canvas **one at a time** with a 200ms gap between calls. Parallel calls were found to trigger Slack rate-limiting. Each call has a 20s timeout with up to 2 retries.

### Phase 3 — Change detection
Each project's canvas `updated` timestamp is compared against the stored `canvasUpdatedAt` in Firestore. If unchanged, the project is skipped (no download, existing deadline count is reused). This keeps most syncs fast — only edited canvases are re-downloaded.

### Phase 4 — Download + parse (parallel)
Changed canvases are downloaded in parallel via `url_private_download` (60s timeout each). The content is Quip-formatted HTML.

**Parser (`parseCanvasHtml`):**
- Loads HTML with Cheerio
- Iterates table rows, tracking phase via rowspan
- Extracts: phase, date, milestone, status (completed checkbox), star flag
- Supports alternate column orders (e.g. Mass Insight uses Phase|Date|Milestone|Status instead of the standard Phase|Milestone|Date|Status — configured via `colOrder: 'date-first'` in the PROJECTS array)
- Runs `expandFeedbackDates()` post-parse to split embedded feedback dates into separate Client-tagged entries

**Date parsing (`parseSlackDate`):**
1. Primary: `slack_date:YYYY-MM-DD` image tag in Quip HTML
2. Fallback: "Week of Month Nth" → approximate date
3. Fallback: plain "Month Nth" text

**Completion detection:**
Quip renders checked checkboxes as `<li class="checked">` in the status column HTML. The parser checks for this class.

### Phase 5 — Write to Firestore
For each re-synced project:
1. Query all existing Firestore docs for the project
2. Detect added, changed, and removed deadlines (tracked fields: milestone, date, phase, led)
3. Delete stale docs (docIds no longer produced by the current parse)
4. Batch-write new/updated docs with `merge: true` to preserve user-set `completed` states
5. Write project metadata (new timestamp, deadline count)
6. Write an `updateLog` entry with full change details

**Doc IDs** are deterministic: `{project-slug}_{YYYY-MM-DD}_{milestone-slug}`. This means re-syncing the same canvas produces the same doc IDs — updates are idempotent.

---

## Secrets

The Slack bot token (`xoxb-...`) is stored in **Firebase Secret Manager** and injected at runtime via the `secrets: ['SLACK_BOT_TOKEN']` function config. It is never in source code or environment files.

---

## Infrastructure

| Component | Service |
|---|---|
| Frontend hosting | Firebase Hosting |
| Database | Firestore (us-east1) |
| Functions | Cloud Functions v2 (us-east1) |
| Auth | Firebase Auth (Google OAuth) |
| Secrets | Firebase Secret Manager |
| Scheduler | Google Cloud Scheduler |
| Source control | GitHub (github.com/deroyperaza/hkt-deadlines) |
| Domain | deadlines.hyperakt.com → Firebase Hosting via Squarespace DNS CNAME |
| SSL | Auto-provisioned by Firebase |
