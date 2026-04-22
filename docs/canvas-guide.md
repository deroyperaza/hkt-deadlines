# Canvas Manager Guide

The Deadlines Dashboard syncs directly from your project's Slack canvas. How you format the canvas determines what shows up — and how accurately. A few habits make a big difference for any new entries going forward — no need to update existing canvases.

---

## Column order

Keep columns in this order:

| Phase | Milestone | Date | Led By | Status |
|---|---|---|---|---|

The sync reads columns by position. If columns are reordered or one is missing, deadlines can misparse or disappear entirely. Inconsistencies can be worked around with custom parsing rules, but that adds fragility — consistent formatting is always cleaner.

---

## One deadline per row

If a milestone has multiple dates (e.g. a delivery date and a feedback date), put each on its own line. Dates embedded inside a milestone description won't be parsed as separate entries.

**Good:**
| Discovery | Brand Strategy R1 | May 5 | Strat | ☐ |
| Discovery | Feedback on Brand Strategy R1 | May 9 | Client | ☐ |

**Avoid:**
| Discovery | Brand Strategy R1 — Feedback due May 9 | May 5 | Strat | ☐ |

---

## Led By column

The dashboard tags every deadline by team. Use one of these values:

- `Design`
- `Strat`
- `UX Strat`
- `AM`
- `PM`
- `Client`

A deadline can list multiple teams if it's a shared responsibility — separate them with ` + ` (e.g. `Design + Strat`).

Without a Led By column the dashboard makes its best guess from the phase name and milestone text — which is often right but not always. A dedicated column ensures accuracy and makes team-level filtering reliable for everyone.

---

## Marking things done

Checking the Status checkbox in the canvas marks the deadline complete in the dashboard on the next sync (nightly at 2am ET, or manually via `/sync-deadlines`).

You can also mark items complete directly in the dashboard app — those don't write back to the canvas, but they are tracked in the Log view with a timestamp and your name.

The Log makes it easy to see each day what has been marked done in the app but still needs to be checked off in the canvas.

---

## Slack date format

Use Slack's built-in date picker when entering dates (type `@` and select a date, or use the canvas date field). This produces a `slack_date:YYYY-MM-DD` tag internally that the sync parses precisely. Plain text dates (e.g. "May 5") work as a fallback but are less reliable.

For approximate dates, prefix with `~` (e.g. `~May 12`) — the dashboard will display these with a tilde to indicate they're estimates.
