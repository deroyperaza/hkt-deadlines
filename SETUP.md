# HKT Deadlines — Setup Guide

## What you'll need
- Node.js installed (https://nodejs.org — LTS version)
- A Google account with Firebase access (your @hyperakt.com account works)
- Slack workspace admin access

Estimated time: ~45 minutes

---

## Step 1 — Install Firebase CLI

```bash
npm install -g firebase-tools
firebase login
```

---

## Step 2 — Create a Firebase project

1. Go to https://console.firebase.google.com
2. Click **Add project** → name it `hkt-deadlines`
3. Disable Google Analytics (not needed) → **Create project**

---

## Step 3 — Enable Firestore

1. In the Firebase console sidebar → **Firestore Database**
2. Click **Create database** → choose **Production mode** → pick region `us-east1` → **Done**

---

## Step 4 — Enable Google Auth

1. In the sidebar → **Authentication** → **Get started**
2. Under **Sign-in providers** → click **Google** → toggle **Enable**
3. Set the support email to your email → **Save**
4. Go to the **Settings** tab → **Authorized domains** — your Firebase domain (`your-project.firebaseapp.com`) is already there. If you add a custom domain later, add it here too.

---

## Step 5 — Get your Firebase web config

1. In the Firebase console → click the gear icon → **Project settings**
2. Scroll to **Your apps** → click **Add app** → choose the **Web** icon (`</>`)
3. Name it `hkt-deadlines-web` → **Register app**
4. Copy the `firebaseConfig` object shown — it looks like:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "hkt-deadlines.firebaseapp.com",
  projectId: "hkt-deadlines",
  storageBucket: "hkt-deadlines.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123..."
};
```

5. Open `public/index.html` and find the `firebaseConfig` block near the bottom of the `<script>` section. Replace all the `REPLACE_WITH_...` values with your actual values.

---

## Step 6 — Connect the Firebase project locally

Open this folder in Terminal:

```bash
cd ~/hkt-deadlines
```

Run:

```bash
firebase use --add
```

Select your `hkt-deadlines` project from the list. This updates `.firebaserc` automatically.

---

## Step 7 — Create the Slack app

1. Go to https://api.slack.com/apps → **Create New App** → **From scratch**
2. Name it `HKT Deadlines` → select your Hyperakt workspace → **Create App**

### Add OAuth scopes
3. Sidebar → **OAuth & Permissions** → scroll to **Bot Token Scopes** → **Add an OAuth Scope**
   Add these scopes:
   - `files:read` (read canvas content)
   - `channels:history` (verify bot is in channels)
   - `chat:write` (post sync results back to Slack)

### Install the app
4. Scroll up → **Install to Workspace** → **Allow**
5. Copy the **Bot User OAuth Token** (starts with `xoxb-`) — you'll need this in Step 8

### Add the bot to every project channel
6. In Slack, open each project channel (`#tfa`, `#mnmf`, etc.) → click the channel name → **Integrations** → **Add apps** → select `HKT Deadlines`

### Register the slash command
7. Back in the app settings sidebar → **Slash Commands** → **Create New Command**
   - Command: `/sync-deadlines`
   - Request URL: `https://us-east1-YOUR_PROJECT_ID.cloudfunctions.net/syncDeadlines`
     *(replace `YOUR_PROJECT_ID` with your Firebase project ID)*
   - Short description: `Sync deadlines from Slack canvases`
   - **Save**

---

## Step 8 — Set the Slack token as a Firebase secret

```bash
firebase functions:secrets:set SLACK_BOT_TOKEN
```

Paste your `xoxb-...` token when prompted.

---

## Step 9 — Add remaining project channels

Open `functions/index.js` and fill in the `PROJECTS` array with the canvas IDs for your other projects.

**How to find a canvas ID:** In each Slack channel, scroll up to find a Slackbot message saying *"made updates to a canvas tab: FXXXXXXXXXX"* — that `F...` code is the canvas ID. The channel ID is in the channel's Slack URL (`/archives/CXXXXXXXXXX`).

---

## Step 10 — Deploy

Install function dependencies first:

```bash
cd ~/hkt-deadlines/functions
npm install
cd ..
```

Deploy everything:

```bash
firebase deploy
```

This deploys:
- The web app to Firebase Hosting (you'll get a `your-project.web.app` URL)
- The two Cloud Functions (`syncDeadlines` slash command + `scheduledSync` nightly)
- Firestore security rules

---

## Step 11 — Run the first sync

In any Slack channel where the bot is installed, type:

```
/sync-deadlines
```

This will read all the project canvases and populate the Firestore database. The web app will update in real time.

---

## Step 12 — Share with the team

Send your team the Firebase Hosting URL (e.g. `https://hkt-deadlines.web.app`). Anyone with an `@hyperakt.com` Google account can sign in.

---

## Adding a custom domain (optional)

1. Firebase console → **Hosting** → **Add custom domain**
2. Enter e.g. `deadlines.hyperakt.com`
3. Add the DNS records shown to your domain registrar
4. Add the custom domain to **Authentication → Settings → Authorized domains**

---

## Day-to-day usage

- **Nightly auto-sync** runs every day at 2am ET automatically
- **On-demand sync**: type `/sync-deadlines` in Slack any time after the PM updates a canvas
- **Completion state**: checking a deadline complete in the web app writes to Firestore instantly — all team members see it update live
- **Live at**: https://deadlines.hyperakt.com
- **Mobile**: add to iPhone home screen via Safari → Share → Add to Home Screen for app-like access
- **Log view**: shows all syncs with change details (added/changed/removed deadlines) and completion events

---

## Adding new projects later

1. Find the canvas ID in the project's Slack channel (see Step 9)
2. Add a line to the `PROJECTS` array in `functions/index.js`
3. Run `firebase deploy --only functions`
4. Run `/sync-deadlines` to pull in the new project's data
