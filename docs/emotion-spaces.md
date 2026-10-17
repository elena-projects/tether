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
- `GET /api/spaces?emotion=...&id=...` returns at most the 12 newest anonymous
  replies for one existing note. `action: comment` accepts up to 180 characters and
  stores only text and timestamp under `emotionSpaceComments/<emotion>/<note-id>`.
- Free-form replies are reviewed in the context of their parent note. Obvious abuse
  and contact details are rejected locally before any model call; moderation also
  blocks harassment, sexual content, dangerous instructions, personal information,
  defamation, rumors, and unverifiable allegations about identifiable people.
- Moderation fails closed. A note can hold at most 60 replies, reads remain bounded,
  and `/api/spaces` has a separate nginx rate-limit zone. POST requests must use
  `application/json`, preventing ordinary cross-site HTML forms from submitting.
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
- Readers can report a note or reply without supplying free-form report text. The
  backend retrieves the stored content and sends a fixed-format report to the private
  inbox, so a caller cannot forge the text shown to the reviewer.
- Notes and their replies expire together after 90 days. Each room read performs a
  bounded cleanup of up to 50 expired notes, so retention does not require a
  permanently running worker.

## Deployment

1. Publish `database.rules.json` with `./deploy-rules.sh`.
2. Copy `integrations/portfolio-api/spaces.js` to Portfolio `api/spaces.js` and
   `integrations/shared/emotion-spaces.js` to Portfolio `shared/emotion-spaces.js`.
3. Deploy Portfolio with its existing `WALL_PROXY_SECRET`, Firebase service-user
   credentials, and `GEMINI_API_KEY`. No new client secrets are required.
4. Deploy Tether with `./deploy.sh`; nginx routes `/api/spaces` with the existing
   private proxy header and its dedicated rate-limit zone.

The feature is additive in the database and backend. Do not deploy a frontend that
depends on this endpoint until the database rules and backend are verified.

## Verification

Run `node --test tests/emotion-spaces.test.mjs`, `npx tsc --noEmit`, and `npm run build`.
Handler tests cover proxy enforcement, JSON-only writes, invalid inputs, anonymous
storage, moderation failures, support routing, bounded pagination, comment caps,
response field filtering, reports, concurrent encouragements, and missing-note
handling. Mocked moderation tests do not establish the real model's classification
accuracy.

UI checks use disposable in-memory fixtures, never fake public users: enter with no
nickname, choose a room, read, encourage, write, preserve text after a failed review,
return to reading, and switch rooms. The fixture HTML must be removed before deploy.

## Release status (2026-10-17)

Anonymous free-form replies were deployed in Tether commits `46412b8` and `4e8af85`,
with Portfolio backend commit `bd9cd21`. Vercel deployment
`portfolio-5hrs6a8q3-elenazheng.vercel.app` is aliased to `elenaprojects.cc`, and Cloud
Run revision `tether-00089-lf4` serves 100% of Tether traffic. Firebase rules were
published with `elena@geminiat.work` before the client rollout.

Fourteen handler tests, TypeScript checking, the production build, diff checks, and a
production dependency audit pass. Local fixture checks at 390x844 and 1440x900 had no
horizontal overflow or console errors. The production 390x844 smoke check also had no
overflow or console errors. Live checks confirmed bounded room reads return 200,
direct Portfolio access returns 403, direct Firebase comment reads return 401,
non-JSON writes return 415, obvious abuse returns 422, and a missing parent returns
404 without publishing anything.

The first rollout revision, `tether-00088-k6p`, exposed a proxy regression that
dropped GET query parameters. The live smoke test caught it immediately; revision
`tether-00089-lf4` preserves `$request_uri` and is the corrected production release.
Do not use `tether-00088-k6p` as a rollback target.

## Release status (2026-10-10)

The hardened Portfolio backend was deployed as
`portfolio-ncfi2bfwl-elenazheng.vercel.app` and aliased to `elenaprojects.cc`.
Unauthenticated requests return 403. The deployed Portfolio homepage was verified
identical to its previously live content.

Firebase rules were published with `elena@geminiat.work`. The production backend
passed a real read, moderated anonymous write, preset encouragement, read-back, and
cleanup check. The disposable verification note was deleted and confirmed absent.
Tether revision `tether-00087-ttf` is serving 100% of Cloud Run traffic. The previous
stable rollback revision is `tether-00086-lvv`.

Ten handler tests, TypeScript checking, and the production build pass. Browser
fixtures verified reading, publishing, encouragement, failure preservation, and
room isolation. Layout checks covered 320x568, 390x844, 667x375, 768x1024, and
1440x900 without horizontal overflow. Production UI checks also verified optional-name
entry, all six emotion choices, room reading, and a 390x844 mobile viewport with no
horizontal overflow. A post-release 390x844 and 1440x900 browser smoke check found no
horizontal overflow or console errors. Direct calls to the private Portfolio endpoint
return 403 while the same-origin Tether proxy returns 200.

Security hardening is recorded in Tether commit `5a40545` and Portfolio commit
`f07c3df`. Generic Gemini and Firebase proxies are retired; public data is served only
through bounded APIs, fixed-action AI runs only in the Portfolio backend, reports reach
the private inbox, and room notes use a 90-day lazy retention policy.

Follow-up commit `3968e10` removes inline-script permission from the production CSP and
pins Cloud Run to at most three instances. Nine retired targeted messages and three
Talks records were exported to an AES-256 encrypted local backup and removed from
Firebase; the 31 public wall records were preserved and verified through the live API.
