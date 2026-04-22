# Led By Rules

The `inferLed(phase, milestone, project)` function in `functions/index.js` automatically assigns a team tag to each deadline when no Led By column is present in the canvas. Rules are evaluated in priority order — the first match wins.

When a Led By column is added to a canvas, its value takes precedence over all inferred rules.

---

## Priority 1 — Milestone keyword rules (highest priority)

These apply regardless of phase or project.

| Keyword in milestone | Assigned to |
|---|---|
| "feedback" | Client |
| "ooo" | Client |
| "naming decision" | Client |
| "board meeting" | Strategy + Creative + Account Management |
| "kick-off" / "kickoff" / "kick off" | Account Management + PM |
| "design layout" + "content writing" | Creative + Strategy |
| "design layout" | Creative |
| "design system" | Creative |
| "brand guide" | Creative |
| "logo" | Creative |
| "content writing" | Strategy |

---

## Priority 2 — Project-level rules

| Project | Assigned to |
|---|---|
| MACP | Strategy (all deadlines) |

---

## Priority 3 — Phase keyword rules

Applied when no milestone keyword matches.

| Keyword in phase | Assigned to |
|---|---|
| "discovery", "strategy", "verbal", "naming" | Strategy |
| "website", "content", "sitemap", "wireframe", "build", "ux" | UX Strategy |
| "implementation", "training", "roadshow" | Account Management |
| *(anything else)* | Creative (default) |

---

## Notes

- Matching is case-insensitive
- Multi-team values (e.g. `Strategy + Creative + Account Management`) display as multiple pills in the dashboard but are stored as a single string
- The `LED_MAP` in `public/index.html` maps these strings to display labels and color classes:

| Stored value | Display label | Color |
|---|---|---|
| Creative | Design | Blue |
| UX Strategy / Content Strategy | UX Strat | Yellow |
| Strategy | Strat | Green |
| Account Management | AM | Peach |
| Client | Client | Purple |
| PM | PM | Mint |

---

## Updating the rules

Edit the `inferLed` function in `functions/index.js`. After making changes:
1. Run `firebase deploy --only functions`
2. Use the `clearMassInsight` admin endpoint (with `?project=ProjectName`) to clear `canvasUpdatedAt` for any affected projects
3. Run `/sync-deadlines` to re-parse with the new rules
