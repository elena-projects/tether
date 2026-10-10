# Portfolio APIs

This directory preserves the Tether handlers deployed by the Portfolio project:

- `wall.js` -> `https://elenaprojects.cc/api/wall`
- `spaces.js` -> `https://elenaprojects.cc/api/spaces`
- `companion.js` -> `https://elenaprojects.cc/api/companion`
- `state.js` -> `https://elenaprojects.cc/api/state`

The deployed Portfolio project must place `wall.js` at `api/wall.js` and configure:

- `WALL_PROXY_SECRET`: shared with the Tether Cloud Run service.
- `GEMINI_API_KEY`: used for server-side Guardian moderation.
- `FIREBASE_API_KEY`: the public Web API key used for Firebase Auth requests.
- `WALL_FIREBASE_EMAIL`: the dedicated low-privilege wall writer account.
- `WALL_FIREBASE_PASSWORD`: the wall writer account password.
- `DATA_SECRET`: the private Firebase path segment for anonymous mood states.
- `STATE_SESSION_SECRET`: signs opaque anonymous state-session tokens.
- `INBOX_SECRET`: stores fixed-format abuse reports from emotion spaces.

Firebase Realtime Database rules must restrict shared-data reads and writes to the
dedicated writer's UID. Do not use a Firebase Admin key or legacy database secret
here. The state endpoint stores only anonymous mood coordinates and
activity time. It also performs server-side matching and returns no more than one
anonymous candidate, so clients never download the users collection. Display names and
journal history remain local to the browser.

Deploy these endpoints before deploying the Tether client or its Firebase rules.
Direct requests without `WALL_PROXY_SECRET` should return 403; a Vercel `404 NOT_FOUND`
means the handler is not deployed yet.
