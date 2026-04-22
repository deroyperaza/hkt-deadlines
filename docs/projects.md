# Projects

All active projects synced to the Deadlines Dashboard. To add a new project, add an entry to the `PROJECTS` array in `functions/index.js` and redeploy.

---

## Active Projects

| Name | Slack Channel ID | Canvas ID | Notes |
|---|---|---|---|
| TFA | C0A8BS18KJP | F0AARPS72CR | Occasionally slow to respond — retry logic handles it |
| MNMF | C092D6W7MR7 | F0920FBC9M0 | |
| MNMF Web | C0AMK4MCQMP | F0AMKG43X8R | |
| Mass Insight | C09BW8FH0FP | F09BJT2A347 | Column order is Phase\|Date\|Milestone\|Status — configured via `colOrder: 'date-first'` |
| SAAF | C09NJ3S0GKZ | F09RC6EMX8R | Canvas download intermittently times out |
| CHCF 30 | C09NBBJ5ATT | F09NJJHAC4F | |
| JVS | C0A2S704Q2U | F0A9X2X9UGP | |
| CLUA | C0AEZ6N6ERG | F0AH4V68RP1 | |
| EFSC | C0A2F64UJP5 | F0AGMENJG5N | Occasionally slow to respond |
| FP | C0ANYASBU4U | F0AHEHCQ999 | |
| MACP | C06PJ58UPLM | F06PPGGLBJQ | All deadlines default to Strat per project-level rule |
| Prysm | C09K3F0NE9K | F09K4V9EDC5 | |

---

## Projects without canvases

These projects are retainer or completed and have no canvas to sync:

| Name | Slack Channel ID | Reason |
|---|---|---|
| RWJF | C03QXS2D6HG | Retainer — no deadline canvas |
| CL IFI | C052005RJF9 | No canvas found |
| SJLF | C09FUTYGECU | No canvas found |

---

## Adding a new project

1. Find the **canvas ID**: In the project's Slack channel, scroll up to find a Slackbot message saying *"made updates to a canvas tab: FXXXXXXXXXX"* — that `F...` code is the canvas ID.
2. Find the **channel ID**: It appears in the channel's Slack URL (`/archives/CXXXXXXXXXX`).
3. Add to `PROJECTS` in `functions/index.js`:
   ```js
   { name: 'Project Name', channelId: 'CXXXXXXXXXX', canvasId: 'FXXXXXXXXXX' },
   ```
4. Run `firebase deploy --only functions`
5. Run `/sync-deadlines` to pull in the new project's data

If the project canvas uses a non-standard column order, add `colOrder: 'date-first'` to the project config (see Mass Insight as an example).

---

## Removing a project

1. Remove its entry from the `PROJECTS` array in `functions/index.js`
2. Deploy: `firebase deploy --only functions`
3. Optionally delete its Firestore docs manually via the Firebase Console, or use the `renameProject` admin endpoint to clear them.
