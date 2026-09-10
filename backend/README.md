# Moodify Tier 1 backend

The React calendar, check-in and capacity dashboard use an Express API with SQLite persistence. This is a local development/hackathon implementation: no cloud deployment or user account system is included.

## Run

Requires Node.js 24 or newer. From the repository root:

```powershell
npm install
npm run dev
```

Open **http://localhost:5173**. Use this hostname consistently: browser sessions are cookie-based. Vite proxies `/api` to `127.0.0.1:3001`. Both services bind to loopback.

```powershell
npm test        # Backend unit + HTTP integration tests
npm run lint   # Frontend lint
npm run build  # Production frontend bundle
```

For a local production-build preview, set `APP_ORIGIN=http://localhost:3001` and `GOOGLE_REDIRECT_URI=http://localhost:3001/api/google/callback` in `backend/.env`, run `npm run build`, then `npm start`. Open http://localhost:3001. Register that separate redirect URI with Google if using OAuth.

## Google Calendar setup

1. Enable Google Calendar API in your Google Cloud project.
2. Configure the OAuth consent screen. Add your testing account when the app is in testing mode.
3. Create an OAuth client of type **Web application**. Add the exact authorized redirect URI: `http://localhost:5173/api/google/callback`.
4. Copy `backend/.env.example` to `backend/.env` and set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Keep these backend-only; never prefix them with `VITE_` or commit the file.
5. Restart the backend. In the app, open **Calendar → Connect Google (read only) → Sync now**.
6. To apply a Google task move or insert recovery into Google, select **Enable Google write access**. Each task still requires a separate approval; recovery has an explicit Google insertion checkbox.

Uses the [Google web-server OAuth flow](https://developers.google.com/identity/protocols/oauth2/web-server), [expanded event listing](https://developers.google.com/calendar/api/v3/reference/events/list), and [conditional event patching](https://developers.google.com/workspace/calendar/api/v3/reference/events/patch). Reads the primary calendar only. Sync covers the past 30 days through the next 90 days; recurring events are expanded by Google and cancelled/declined/transparent events are omitted. Sync replaces the Google snapshot only after every page succeeds. The app never moves an event with other attendees.

Tokens are encrypted using AES-256-GCM before database storage. An encryption key is generated in `backend/data/token.key`, or use a persistent 64-character hex `TOKEN_ENCRYPTION_KEY`. Keep the key with a protected database backup; losing it requires reconnecting Google. Disconnect clears the app's stored tokens and Google snapshot; account-level access can also be revoked in Google account settings.

Google calls have timeouts. Task updates use the imported ETag to reject concurrent edits, and recheck destination availability before writing. Recovery inserts use stable Google IDs to recover from an accepted write whose response was lost. Google and SQLite are not a distributed transaction: after an uncertain provider/network failure, sync before trying again. A concurrent Google edit can still occur after the availability check.

## What is implemented

| Tier 1 | Implementation |
| --- | --- |
| Calendar sync | Google OAuth read/sync + `.ics` import/export + local event CRUD. |
| Auto classification | Explainable keyword rules; Cognitive, Social, Recharge; manual corrections. Imported events start fixed/high consequence until reviewed. |
| Load formula | `max(0, Σ(category weight × actual hours on the selected local day))`. Cognitive 1.3, Social 1, Recharge −0.5. Short/overnight/DST events supported. |
| Daily check-in | Optional 1–5; one value per local day, updated on repeat taps. Yesterday's score and the optional survey do not affect today's capacity. |
| Capacity gauge | Load normalized to an 8-hour reference and capped at 100%; stress normalized from 1–5 to 0–100%. Combined 45% load / 55% stress when a check-in exists; load-only otherwise. Higher means more capacity used. |
| Load Shedder | Chooses an upcoming flexible low/medium-consequence task with a safe move to a lighter day. Real before/after capacity, destination load and task approval. |
| Recovery Scheduler | Searches 08:00–21:00 for 15/20-minute available slots; matches activity to stress and load mix; uses long calendar blocks as an inactivity proxy; approved insertion. |
| Timetable Suggester | Up to five individual alternatives within the next three days; deadlines, fixed commitments, attendees, completed/past events and overlaps respected. Approval invalidates other suggestions so the next move is recomputed. |

Scheduling and classification are **rule-based**, not LLM calls. No model key is required and no calendar text is sent to an AI provider. These are workload heuristics, not calibrated health measurements. All-day entries occupy scheduling time but contribute zero duration-based load, since an all-day deadline does not imply 24 hours of effort.

New sessions start empty. Existing diary/mood/settings continue using browser storage. Legacy demo calendar/check-in values are not silently copied into real backend data.

The category breakdown displays signed weighted hours: Cognitive and Social add load, Recharge offsets it, and net load is clamped at zero. Bars use a shared scale with negative contributions left of zero and positive contributions right of zero.

Recovery streaks automatically count timed Recharge events once their end time passes, using the end date in the user's calendar time zone. Multiple blocks on one day count as one streak day; future, ongoing and all-day blocks do not count. Completion is inferred from calendar timing, not proof the activity happened. No confirmation click is required. State responses recalculate from saved events, so reopening the app catches up without a background job; the frontend also refreshes each minute and on focus. Calendar edits, deletion or sync can revise the inferred streak. Existing explicit completion records remain distinguished as confirmed, but use the event's end date for streak attribution.

## ICS behavior

Uses [node-ical](https://github.com/jens-maus/node-ical) for TZID, recurrence, EXDATE and recurrence overrides. Floating date-times are interpreted in the configured calendar time zone. Imports use the same rolling range as Google; daily/weekly/monthly/yearly recurrence is supported. More frequent recurrence is rejected. Parsing runs in a worker with time/memory limits; max file size is 800 KB in the UI, with an API JSON limit of 1 MB and 2,000 imported instances per file.

Reimport the **same filename** to replace that imported calendar's snapshot in the active range while retaining matching events' corrections/flexibility. Renaming a file treats it as a different calendar. `.ics` changes are local copies; export them to move data elsewhere. Google-origin events are edited remotely only through approved proposals, not ordinary local event editing.

## API

Mutating routes require JSON and `X-Moodify-Client: web`. Cookies are HttpOnly, SameSite=Lax (Secure for HTTPS origins). Origin checks reject cross-origin browser requests. State is isolated by browser session and mutations are serialized per user.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Health check |
| GET | `/api/state?date=YYYY-MM-DD` | Events, selected-day capacity, check-in and safe Google status |
| PUT | `/api/preferences` | `{ zone: "Asia/Kuala_Lumpur" }` |
| POST | `/api/events` | Create event: title, ISO start/end, optional category (`auto` default), isFlexible, consequence, deadline |
| PATCH / DELETE | `/api/events/:id` | Edit/delete local events; Google supports local classification/flexibility metadata only |
| POST | `/api/checkins` | `{ score: 1..5 }`; today determined by server and user zone |
| POST | `/api/calendar/import` | `{ name, text }` ICS snapshot |
| GET | `/api/calendar/export` | Download RFC 5545 calendar |
| POST | `/api/proposals` | `{ kind: "shed" | "timetable" | "recovery", date? }` |
| POST | `/api/proposals/:id/apply` | `{ approved: true, writeToGoogle?: true }`; rejects stale/expired proposals |
| POST | `/api/events/:id/complete` | Mark an ended recharge block completed |
| POST | `/api/google/connect` | `{ write?: true }`; returns OAuth URL |
| GET | `/api/google/callback` | Validates one-time session-bound OAuth state |
| POST | `/api/google/sync` | Refresh Google snapshot |
| POST | `/api/google/disconnect` | Forget connection and imported Google events locally |

Data is in `backend/data/moodify.sqlite`, ignored by Git. Browser session access lasts 30 days; clearing cookies creates a new empty session. A production deployment needs proper account login/recovery, durable secret management, HTTPS, rate limiting, backups and deployment configuration. Do not expose this local demo as a public multi-user service as-is.

## Validation limits

Unit and HTTP integration tests exercise the real API and SQLite, import/export, stress/load calculations, proposals, stale approvals, data isolation and remote-failure behavior. Google write tests use a mock provider; live OAuth, consent and calendar writes must be verified with your configured Google testing account. No real Google calendar was modified during implementation.
