# Emotion Spaces

People choose an emotion space for the current moment, then independently choose to
read or write. Participation is never selected by a permanent account role. The six
spaces are anxious, sad, lonely, tired/low, hard to name, and calm/okay. Mood coordinates
may suggest a space; they do not diagnose a feeling or prevent choosing another one.

Leaving the nickname blank enters the spaces without creating a named session. Notes
also remain anonymous when a visitor uses an optional local nickname.

## Data and moderation

- `GET /api/spaces?emotion=...&cursor=...` returns at most 20 notes, newest first.
- `POST /api/spaces` with `action: note` reviews first-person expression and stores
  only text and timestamp under `emotionSpaces/<emotion>/notes/<push-id>`.
- Sadness, anxiety, loneliness, and exhaustion are allowed. The separate legacy wall
  remains a kindness-only surface. Existing wall posts are not assigned fabricated
  emotions or mixed into a room.
- If moderation fails or returns an ambiguous response, nothing is published. A
  personal crisis response offers the existing private support screen. Abuse,
  identifying/contact information, and dangerous instructions are not published.
- `action: encourage` accepts only a room-specific preset index, never arbitrary
  comment text. Three suggestions per space live in the shared configuration.
- Encouragement counts use Firebase conditional writes with ETags. Counts represent
  sends, not unique people. The UI prevents repeat sends while the room remains open;
  this is not an identity-based anti-abuse guarantee. nginx rate limits the endpoint.
- Notes have no author IDs, profiles, follow graph, notifications, or account linkage.
  Server infrastructure still processes ordinary HTTP requests; this is not a claim
  of network-level anonymity.
- Direct client reads/writes of the new database node are denied. Only the dedicated
  backend Firebase user can access it, through the bounded API.

## Deployment

1. Publish `database.rules.json` with `./deploy-rules.sh`.
2. Copy `integrations/portfolio-api/spaces.js` to Portfolio `api/spaces.js` and
   `integrations/shared/emotion-spaces.js` to Portfolio `shared/emotion-spaces.js`.
3. Deploy Portfolio with its existing `WALL_PROXY_SECRET`, Firebase service-user
   credentials, and `GEMINI_API_KEY`. No new client secrets are required.
4. Deploy Tether with `./deploy.sh`; nginx routes `/api/spaces` with the existing
   private proxy header and wall rate-limit zone.

The feature is additive in the database and backend. Do not deploy a frontend that
depends on this endpoint until the database rules and backend are verified.

## Verification

Run `node --test tests/emotion-spaces.test.mjs`, `npx tsc --noEmit`, and `npm run build`.
Handler tests cover proxy enforcement, invalid inputs, anonymous storage, moderation
failures, support routing, bounded pagination, response field filtering, concurrent
encouragements, and missing-note handling. Mocked moderation tests do not establish
the real model's classification accuracy.

UI checks use disposable in-memory fixtures, never fake public users: enter with no
nickname, choose a room, read, encourage, write, preserve text after a failed review,
return to reading, and switch rooms. The fixture HTML must be removed before deploy.

## Release status (2026-10-10)

The Portfolio backend was deployed as `portfolio-mm1a5lm5v-elenazheng.vercel.app`
and aliased to `elenaprojects.cc`. Unauthenticated requests return 403. The deployed
Portfolio homepage was verified identical to its previously live content.

Firebase rules were published with `elena@geminiat.work`. The production backend
passed a real read, moderated anonymous write, preset encouragement, read-back, and
cleanup check. The disposable verification note was deleted and confirmed absent.
Tether revision `tether-00085-q5q` is serving 100% of Cloud Run traffic. The previous
stable rollback revision is `tether-00084-mp7`.

Seven handler tests, TypeScript checking, and the production build pass. Browser
fixtures verified reading, publishing, encouragement, failure preservation, and
room isolation. Layout checks covered 320x568, 390x844, 667x375, 768x1024, and
1440x900 without horizontal overflow. Production UI checks also verified optional-name
entry, all six emotion choices, room reading, and a 390x844 mobile viewport with no
horizontal overflow. Direct calls to the private Portfolio endpoint return 403 while
the same-origin Tether proxy returns 200.
