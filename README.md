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
React 19 · Vite · Tailwind (CDN) · Google **Gemini** (strict content moderation + personalised comfort) · **Firebase** Realtime Database over REST + polling · d3. Deployed on **Google Cloud Run** (nginx) with a same-origin proxy so it stays reachable on restricted networks.

## Run locally
```bash
npm install
echo 'GEMINI_API_KEY="your-gemini-key"' > .env.local
npm run dev
```

---
Built by **Elena**, a high-school student in Shanghai — a psychology & wellness project. More at [elenaprojects.cc](https://elenaprojects.cc).
