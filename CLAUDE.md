# HKT Deadlines — Claude Context

## Two-Copy Workflow (CRITICAL)

This project lives in two places. **Edits happen on Drive. Deploys happen from Local.**

| Copy | Path |
|------|------|
| **Google Drive** (edit here) | This folder — `HKT Deadlines/hkt-deadlines/` |
| **Local** (deploy from here) | `~/Claude Dev/hkt-deadlines/` |

### After every edit, sync then deploy:

```bash
# 1. Sync Drive → Local
rsync -av --exclude='functions/node_modules' --exclude='.firebase' --exclude='firebase-debug.log' \
  "/Users/deroyperaza/Library/CloudStorage/GoogleDrive-deroy@hyperakt.com/Shared drives/Brand & Marketing/HKT AI/Hyperakt/HKT Deadlines/hkt-deadlines/" \
  "/Users/deroyperaza/Claude Dev/hkt-deadlines/"

# 2. Deploy from local
cd ~/Claude\ Dev/hkt-deadlines
firebase deploy --only hosting     # for frontend changes (public/index.html)
firebase deploy --only functions   # for backend changes (functions/index.js)
```

**Never deploy from the Drive path** — node_modules on a network drive causes Firebase CLI timeouts.
**Never edit files in the local copy** — Drive is the source of truth.

## Project Overview

- **Live URL:** https://deadlines.hyperakt.com
- **Firebase project:** `hkt-deadlines`
- **Frontend:** `public/index.html` (single-file app)
- **Backend:** `functions/index.js` (Firebase Cloud Functions)
- **Database:** Firestore

## Adding a New Project

1. Find canvas ID: look in the Slack channel for a Slackbot message like *"made updates to a canvas tab: FXXXXXXXX"*
2. Find channel ID: from the channel's Slack URL (`/archives/CXXXXXXXXXX`)
3. Add to `PROJECTS` array in `functions/index.js`:
   ```js
   { name: 'Project Name', channelId: 'CXXXXXXXXX', canvasId: 'FXXXXXXXXX' },
   ```
   If the canvas has columns in **Phase | Date | Milestone** order (instead of the standard Phase | Milestone | Date), add `colOrder: 'date-first'`.
4. Sync + deploy functions
5. Run `/sync-deadlines` in Slack
6. If the project was previously synced with bad data, clear its Firestore cache:
   ```bash
   # Get access token
   TOKEN=$(python3 -c "import json; d=json.load(open('/Users/deroyperaza/.config/configstore/firebase-tools.json')); print(d['tokens']['access_token'])")
   # Clear canvasUpdatedAt for the project
   curl -s -X PATCH \
     "https://firestore.googleapis.com/v1/projects/hkt-deadlines/databases/(default)/documents/projects/PROJECT_NAME?updateMask.fieldPaths=canvasUpdatedAt&updateMask.fieldPaths=deadlineCount" \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"fields": {}}'
   ```
