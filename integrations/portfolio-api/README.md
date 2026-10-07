# Portfolio APIs

This directory preserves the Tether handlers deployed by the Portfolio project:

- `wall.js` -> `https://elenaprojects.cc/api/wall`
- `state.js` -> `https://elenaprojects.cc/api/state`

The deployed Portfolio project must place `wall.js` at `api/wall.js` and configure:

- `WALL_PROXY_SECRET`: shared with the Tether Cloud Run service.
- `GEMINI_API_KEY`: used for server-side Guardian moderation.
- `FIREBASE_API_KEY`: the public Web API key used for Firebase Auth requests.
- `WALL_FIREBASE_EMAIL`: the dedicated low-privilege wall writer account.
- `WALL_FIREBASE_PASSWORD`: the wall writer account password.
- `DATA_SECRET`: the private Firebase path segment for anonymous mood states.
- `STATE_SESSION_SECRET`: signs opaque anonymous state-session tokens.

Firebase Realtime Database rules must restrict new message creation and mood-state
writes to the dedicated writer's UID. Do not use a Firebase Admin key or legacy
database secret here. The state endpoint stores only anonymous mood coordinates and
activity time; display names and journal history remain local to the browser.

Deploy both endpoints before deploying the Tether client or its Firebase rules. A GET
request should return `405 post_only`; a Vercel `404 NOT_FOUND` means the handler is
not deployed yet.
