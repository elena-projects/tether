# 🤍 Tether

> A calm place when your feelings get heavy.

![Tether](https://elenaprojects.cc/og-tether.png)

**Live:** https://tether.elenaprojects.cc · **About:** https://elenaprojects.cc/tether

Tether turns how you feel into something you can see and hear — your emotion becomes *weather* — then quietly connects you with others who feel the same, so you can trade small notes of encouragement and take a moment to breathe. It draws on ideas from psychology like **affect labeling** (naming a feeling to soften it) and **mattering** (knowing you count to someone).

## What's inside
- 🌦️ Map your feeling on a 2-D *valence × arousal* pad — colour and sound shift with you
- 💌 A moderated **wall of kind words** — send and receive gentle, anonymous notes
- 🫧 A guided **breathing** moment for when your body needs to settle
- 💛 Personalised AI comfort · 🌗 day / night theme · 🌏 中文 / English
- 🆘 Real crisis hotlines always one tap away

> Tether isn't a substitute for professional help — it keeps real support one tap away.

## Tech
React 19 · Vite · Tailwind CSS (build-time) · Google **Gemini** (server-side moderation + personalised comfort) · **Firebase** Realtime Database behind bounded server APIs · d3. Deployed on **Google Cloud Run** (nginx) with same-origin proxies so it stays reachable on restricted networks.

Public wall posts are moderated by `https://elenaprojects.cc/api/wall` before the
server writes them to Firebase. Reads are bounded and remove internal identifiers; the
browser cannot read or write Firebase messages directly.
Mood-state sync uses server-signed anonymous sessions through
`https://elenaprojects.cc/api/state`. Matching is performed server-side and returns at
most one anonymous candidate; journal history remains local to the device.

## Run locally
```bash
npm install
echo 'WALL_PROXY_SECRET="your-proxy-secret"' > .env.local
npm run dev
```

The secret must match the Portfolio APIs. AI requests use the fixed-action
`/api/companion` endpoint; no Gemini key belongs in the browser or Tether container.

## Deploy

Deploy the handlers in `integrations/portfolio-api/` to the matching Portfolio `api/`
paths first, then deploy Tether:

```bash
./deploy-rules.sh
./deploy.sh
```

The Tether Cloud Run service contains only `WALL_PROXY_SECRET`. It runs as the no-role
`tether-runtime` service account. `deploy.sh` removes retired Tether secrets and never
places the proxy secret in the browser bundle.

The Portfolio deployment must contain `WALL_PROXY_SECRET`, `GEMINI_API_KEY`,
`FIREBASE_API_KEY`, `WALL_FIREBASE_EMAIL`, `WALL_FIREBASE_PASSWORD`, `DATA_SECRET`,
`STATE_SESSION_SECRET`, and `INBOX_SECRET`. Firebase rules allow shared-data access
only for the dedicated Auth user.

---
Built by **Elena**, a high-school student in Shanghai — a psychology & wellness project. More at [elenaprojects.cc](https://elenaprojects.cc).
