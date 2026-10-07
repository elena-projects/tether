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
React 19 · Vite · Tailwind CSS (build-time) · Google **Gemini** (strict content moderation + personalised comfort) · **Firebase** Realtime Database over REST + polling · d3. Deployed on **Google Cloud Run** (nginx) with same-origin proxies so it stays reachable on restricted networks.

Public wall posts are moderated by `https://elenaprojects.cc/api/wall` before the
server writes them to Firebase. The browser cannot create Firebase messages directly.
Mood-state sync uses server-signed anonymous sessions through
`https://elenaprojects.cc/api/state`. Matching is performed server-side and returns at
most one anonymous candidate; journal history remains local to the device.

## Run locally
```bash
npm install
echo 'GEMINI_API_KEY="your-gemini-key"' > .env.local
npm run dev
```

Local wall posting and remote mood-state sync also require `WALL_PROXY_SECRET` in
`.env.local`. It must match the secret configured for the Portfolio APIs.

## Deploy

Deploy `integrations/portfolio-api/wall.js` and `state.js` as the Portfolio project's
`api/wall.js` and `api/state.js` first, then deploy Tether:

```bash
./deploy-rules.sh
./deploy.sh
```

The Tether Cloud Run service must already contain `GEMINI_API_KEY`, `TALKS_SECRET`,
and `WALL_PROXY_SECRET`. It runs as the no-role `tether-runtime` service account.
`deploy.sh` preserves existing environment variables and never places them in the
browser bundle.

The Portfolio deployment must contain `WALL_PROXY_SECRET`, `GEMINI_API_KEY`,
`FIREBASE_API_KEY`, `WALL_FIREBASE_EMAIL`, `WALL_FIREBASE_PASSWORD`, `DATA_SECRET`,
and `STATE_SESSION_SECRET`. Firebase rules allow wall and mood-state writes only for
the dedicated Auth user.

---
Built by **Elena**, a high-school student in Shanghai — a psychology & wellness project. More at [elenaprojects.cc](https://elenaprojects.cc).
