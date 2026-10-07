# Tether Project Notes

## Project

Tether is deployed at `https://tether.elenaprojects.cc`.

The app is hosted on Google Cloud Run and uses Firebase Realtime Database for shared data.

## Local Path

The active source folder is:

```bash
/Users/elena/Documents/ChatGPT/elena's websites/tether
```

## Hosting

- Service: `tether`
- Platform: Google Cloud Run
- Region: `us-west1`
- Google Cloud project: `m-gemini-1127`
- Firebase Realtime Database: `tether-7fc38-default-rtdb.asia-southeast1.firebasedatabase.app`

Deploy with:

```bash
cd "/Users/elena/Documents/ChatGPT/elena's websites/tether" && ./deploy.sh
```

Deploy Realtime Database rules separately with:

```bash
cd "/Users/elena/Documents/ChatGPT/elena's websites/tether" && ./deploy-rules.sh
```

## Design And UX

- Dual day/night theme.
- First-time experience defaults to `night`.
- Theme is persisted in `localStorage['tether.theme']`.
- Emotion interface uses a Russell 2D Valence x Arousal pad.
- Ambient WebAudio sound is off by default.
- The production browser bundle is self-contained and does not load application code from a CDN.

## Tether Talks

The 1-on-1 confide feature, also called Tether Talks, was paused on 2026-10-04.

Reason:

- The public Talks entry was removed and redirects to `/`.
- The old `allTalks()` implementation downloaded the entire secret node to clients.
- nginx returns `403` for `/talks/` while the feature is paused.

Before re-enabling Tether Talks:

- Add Firebase Anonymous Auth.
- Require `auth.uid`.
- Add per-thread Firebase Realtime Database rules.

## Wall Moderation

Public kind-word posts must go through the server-side Guardian endpoint:

1. The browser posts to the same-origin `/api/wall` route.
2. Tether's nginx rate-limits the request and adds `WALL_PROXY_SECRET`.
3. nginx forwards the request to `https://elenaprojects.cc/api/wall`.
4. The portfolio API runs strict Gemini moderation and writes approved messages as a dedicated low-privilege Firebase Auth user.

The handler's integrated source copy is `integrations/portfolio-api/wall.js`. Deploy it
as the Portfolio project's `api/wall.js` before deploying Tether or its database rules.

The Portfolio deployment must provide `WALL_PROXY_SECRET`, `GEMINI_API_KEY`,
`FIREBASE_API_KEY`, `WALL_FIREBASE_EMAIL`, and `WALL_FIREBASE_PASSWORD`. The
Tether Cloud Run service must provide the same `WALL_PROXY_SECRET` value. Firebase
rules restrict message creation to the dedicated service user's UID.

Do not restore direct browser creation under the Firebase `messages` node. Client-side
checks are useful for immediate feedback, but they are not a security boundary.

## Anonymous Mood-State Sync

Mood coordinates are synced through the same-origin `/api/state` route:

1. The browser asks for a server-signed anonymous session containing an opaque UID.
2. Tether nginx rate-limits the request and adds `WALL_PROXY_SECRET`.
3. The Portfolio `api/state.js` handler verifies an HMAC token and validates the
   valence/arousal range.
4. The handler writes to `users/<DATA_SECRET>/<uid>` as the dedicated Firebase Auth user.

The same endpoint performs matching inside the server and returns at most one active,
anonymous candidate. The browser cannot list the users collection, never receives
`DATA_SECRET`, and cannot read or write mood records directly. Display names and journal
history stay local to the device. Do not re-enable remote history without a separate
authenticated, user-scoped design.

The Portfolio deployment also requires `DATA_SECRET` and a high-entropy
`STATE_SESSION_SECRET`. The integrated source copy is
`integrations/portfolio-api/state.js`.

## Feedback System

Tether participates in the shared cross-site feedback and inbox system.

- The floating feedback pill posts to `https://elenaprojects.cc/api/feedback`.
- Feedback is written to Firebase under `feedback/<INBOX_SECRET>`.
- Private inbox UI: `https://elenaprojects.cc/inbox`.
- Tether uses three empathetic reply tiers: `normal`, `heavy`, and `crisis`.
- Heavy and crisis messages route to the `心里话` section at the top of `/inbox`.
- Crisis responses include 988 and crisis hotline resources.

## Security

Firebase Realtime Database uses secret-scoped server paths for private data:

- The anonymous mood index is stored under `users/<DATA_SECRET>` and written only by
  the server-side state endpoint.
- Private feedback is stored under `feedback/<INBOX_SECRET>`.
- Paused one-to-one messages are stored under `talks/<TALKS_SECRET>`.
- The public wall is readable, but new messages are created only by the moderated server endpoint.

Cloud Run nginx rate limiting is keyed on the last IP in `X-Forwarded-For`, which is
appended by Google Front End. Keep the Gemini, wall, and state limits in separate zones.

The Cloud Run service runs as
`tether-runtime@m-gemini-1127.iam.gserviceaccount.com`, which intentionally has no
project IAM roles. Do not switch it back to the default Compute service account. The
old AI Studio GCS volume is obsolete and must remain removed.

The Gemini API key is shared by Feynman AI, CogniCard, and Tether. Do not delete or
rotate it without updating all three Cloud Run services.
