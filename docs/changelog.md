# Changelog

---

## April 2026 — Initial build + iterative improvements

### Infrastructure
- Firebase project created (`hkt-deadlines`), Firestore + Auth + Hosting + Cloud Functions configured
- Custom domain live at **deadlines.hyperakt.com** (Squarespace DNS → Firebase Hosting, SSL auto-provisioned)
- GitHub repo: github.com/deroyperaza/hkt-deadlines
- Slack bot created with `files:read`, `channels:history`, `chat:write` scopes
- `/sync-deadlines` slash command wired to Cloud Function

### Sync engine
- Quip HTML canvas parser built with Cheerio — reads Phase | Milestone | Date | Status columns
- Deterministic Firestore doc IDs (project + date + milestone slug) — re-syncs are idempotent, completion states preserved
- Change detection: skips canvases with unchanged `updated` timestamps
- Serialized metadata fetches (200ms gap) to avoid Slack rate-limiting
- Per-request timeouts (20s metadata, 60s download) with retry logic
- Stale doc cleanup: removes Firestore docs no longer produced by current parse
- Sync change tracking: Log records added / changed / removed deadlines per sync
- Audit log: every sync (manual + scheduled) and every completion event written to `updateLog`
- Nightly scheduled sync at 2am ET

### Projects
- Initial projects: TFA, MNMF, MNMF Web, Mass Insight, SAAF, CHCF 30, JVS, CLUA, EFSC, FP, MACP, Prysm
- Mass Insight: custom `colOrder: 'date-first'` parser config for non-standard column order
- MACP: project-level rule — all deadlines default to Strategy

### Parsing
- `inferLed()` — rule-based team tagging from phase and milestone keywords
- `expandFeedbackDates()` — splits embedded feedback dates into separate Client-tagged entries
- Handles "Feedback in X days: Month Nth" and "Feedback in X days" patterns
- "TO BE SCHEDULED" stripped from milestone text
- Approximate dates (`~`) preserved as visual indicator

### Frontend — Views
- List view: deadlines grouped by month, week separators, star flags, completion checkboxes
- Calendar view: monthly grid with dot indicators and detail panel
- Plan view: horizontal Gantt timeline (Apr–Dec), one row per project, month nav scrolls timeline
- Log view: audit trail grouped by date, sync diffs, completion events

### Frontend — Filtering
- Filter by team (Design, Strat, UX Strat, AM, PM, Client)
- Filter by project (dropdown)
- Search by deadline or project name
- Show All / Hide Completed toggle (default: completed items hidden)
- Month nav tabs for fast jumping

### Frontend — Mobile
- Responsive layout for all views
- iOS standalone mode: `signInWithRedirect` instead of `signInWithPopup` (popup blocked in home screen web apps)
- Clock icon replaces title text on small screens
- Narrower client column, week separator fix
- Favicon + apple-touch-icon (Hyperakt orange arrow logo)
- Installable to iPhone home screen via Safari → Share → Add to Home Screen

### Firestore rules
- All reads restricted to `@hyperakt.com` accounts
- `deadlines`: users can only update the `completed` field
- `updateLog`: users can create entries (completion events); no edits or deletes
- `projects`, `meta`: read-only for users
