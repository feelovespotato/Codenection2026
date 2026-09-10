# Moodify workload and recovery backend

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

Classification and calendar constraints use deterministic rules. Optional AI rewrites boundary drafts, selects recovery activities from a vetted list, and ranks already-valid task moves. Without working provider keys the original rules/templates remain available. These are workload heuristics, not calibrated health measurements. All-day entries occupy scheduling time but contribute zero duration-based load, since an all-day deadline does not imply 24 hours of effort.

New sessions start empty. Existing diary/mood/settings continue using browser storage. Legacy demo calendar/check-in values are not silently copied into real backend data.

The category breakdown displays signed weighted hours: Cognitive and Social add load, Recharge offsets it, and net load is clamped at zero. Bars use a shared scale with negative contributions left of zero and positive contributions right of zero.

The main recovery streak counts completed one-minute in-app breathing sessions, persisted in SQLite. Starting, stopping early or closing the pacer does not count. Completion requires a server-issued session and at least 60 seconds of elapsed server time; sessions expire after 30 minutes and repeated completion requests are idempotent. The UI counts active timer ticks before submitting completion. This records in-app completion, not physical participation or physiological recovery. Completed sessions use their completion date in the user's time zone, one streak day per date. Ended calendar recharge blocks remain a separate, explicitly inferred calendar streak; calendar changes do not alter completed-session history.

## Tier 2 features

Open the Capacity Dashboard and scroll below the scheduling tools.

| Feature | Behavior |
| --- | --- |
| Boundary Guard | Editable warm/direct decline or defer drafts for a selected event or custom commitment, with optional alternative timing. AI rewrites the draft when configured, with local template fallback. Copy only; never sends a message to the recipient or includes check-in data in the draft context. |
| Task Batching | Groups 2–4 upcoming flexible local/.ics/Google errands, each at most 45 minutes and 120 minutes combined. Local-only batches apply atomically. Batches containing Google events reserve an initially free destination and require per-task approval; successful moves remain saved if another fails. Google write scope, current conflicts and ETags are checked through the existing remote move flow. Fixed/high-consequence/all-day/attendee events are excluded. Review travel time and opening hours. |
| Sleep Proxy Estimator | Longest unoccupied interval in the previous evening’s 21:00–09:00 window, capped at the current time. Merges overlapping calendar commitments and uses the user's time zone, including DST. No nearby calendar coverage returns no estimate. This estimates possible sleep opportunity, not actual sleep. |
| Deadline Density | Returns one heaviest qualifying day among tomorrow and the following two days. Qualifies at 3 deadline signals or 6.4 weighted hours; ranks by deadline count plus weighted hours. Explicit deadlines take precedence over exam/due/submission/deadline keywords; each event contributes at most one signal. |
| Category Breakdown | Signed category contributions and net weighted load. |
| Recovery Streak | Completed in-app sessions saved automatically; inferred calendar streak shown separately. |
| Load Snapshot Share | PNG card generated in the browser with capacity used, date and time zone only. User-triggered native file sharing where supported; download fallback otherwise. |

The prototype works without AI keys and can optionally use the providers below. Sleep and recovery are explicitly labelled proxies. Data comes from the current synced snapshot; refresh Google Calendar to include remote changes.

### Additional API behavior

- `GET /api/state` includes `insights.sleep` and `insights.deadlines`.
- `POST /api/boundary-template`: `{ intent: "decline" | "defer", tone: "warm" | "direct", eventId? , commitment?, alternative? }` returns `{ text, method: "ai" | "template", provider?, fallbackReason? }` for the current session.
- `POST /api/proposals` accepts `kind: "batch"` and a local `date`. Approve local-only batches with `{ approved: true }`. When `individualApproval` is true, include `eventId` for each individual move. Responses return the updated proposal and revision; applied moves cannot replay. Unrelated schedule mutations invalidate remaining approvals.

## Optional AI with provider fallback

Add keys to `backend/.env` (never a `VITE_` variable). The existing Google OAuth settings stay separate. Blank keys are skipped; one working key is enough. Restart the backend after changing keys, models or order.

```dotenv
AI_ENABLED=true
AI_PROVIDER_ORDER=groq,openrouter,gemini
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openrouter/free
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
AI_ALLOW_PAID_PROVIDERS=false
AI_TIMEOUT_MS=8000
AI_TOTAL_TIMEOUT_MS=25000
AI_COOLDOWN_MS=60000
AI_REQUESTS_PER_MINUTE=10
```

- Groq keys: [Groq console](https://console.groq.com/keys), [text generation docs](https://console.groq.com/docs/text-chat). Groq is a different service from xAI/Grok.
- OpenRouter keys: [OpenRouter settings](https://openrouter.ai/settings/keys), [free model router](https://openrouter.ai/docs/cookbook/get-started/free-models-router-playground). The default uses `openrouter/free`; paid model IDs are skipped unless `AI_ALLOW_PAID_PROVIDERS=true`.
- Gemini keys: [Google AI Studio](https://aistudio.google.com/apikey), [API key docs](https://ai.google.dev/gemini-api/docs/generate-content/api-key), [default model](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash).

Free API keys are not unlimited service. Model availability, free quotas and billing depend on the provider account. The paid-model guard only controls OpenRouter model selection; it cannot determine Gemini/Groq billing settings. No credit purchase or provider account change is performed by this app.

Each action tries available providers in order, at most once each. HTTP errors, quota/rate limits, timeouts, invalid/empty output and network errors move to the next provider. Failures enter a cooldown (normally 60 seconds, at least 5 minutes for key/model/billing errors); `Retry-After` can extend it. After the cooldown a provider is eligible again. An 8-second per-provider timeout and 25-second overall budget bound normal latency. Explicit moderation refusals stop remote fallback. If all providers fail, are disabled, or lack keys, the UI clearly identifies the local rule/template result. Limits of 10 AI actions per session per minute and 4 concurrent actions protect the demo from accidental rapid usage. These limits are in-memory and reset on restart; they are not a production billing control.

Boundary Guard sends only the drafted commitment, requested tone/intent and optional alternative time. Scheduling sends aggregate stress/category-hour values and numeric candidate workload effects; calendar titles/descriptions, diary entries, Google credentials and event IDs are omitted. A failed attempt may already have transmitted that context, and the next configured provider receives the same context. Providers have their own data policies. No AI requests happen merely from loading the dashboard or syncing the calendar.

AI output cannot create new times, event IDs or arbitrary recovery activity names. Recovery is selected from predefined activities, while task ranking must be a valid permutation of rule-validated candidates. Existing deadline, conflict and per-task approval checks still run before Google writes. Batch moves remain local/.ics only. There are no AI tools or autonomous calendar writes.

To test after setting keys: restart with `npm start`, refresh the page, and generate a Boundary Guard draft. The result displays the actual provider used or an explicit local-template fallback. `GET /api/ai/status` returns key presence/configuration and cooldown status without keys or raw errors; `ready` means configured and eligible, not proven connectivity. The dashboard refreshes this status on focus or every minute. Unit and HTTP tests mock the providers; they do not consume real credits or verify your keys.

## ICS behavior

Uses [node-ical](https://github.com/jens-maus/node-ical) for TZID, recurrence, EXDATE and recurrence overrides. Floating date-times are interpreted in the configured calendar time zone. Imports use the same rolling range as Google; daily/weekly/monthly/yearly recurrence is supported. More frequent recurrence is rejected. Parsing runs in a worker with time/memory limits; max file size is 800 KB in the UI, with an API JSON limit of 1 MB and 2,000 imported instances per file.

Reimport the **same filename** to replace that imported calendar's snapshot in the active range while retaining matching events' corrections/flexibility. Renaming a file treats it as a different calendar. `.ics` changes are local copies; export them to move data elsewhere. Google-origin times can be changed through approved proposals or by explicitly saving new dates/times in the Calendar form.

## API

Mutating routes require JSON and `X-Moodify-Client: web`. Cookies are HttpOnly, SameSite=Lax (Secure for HTTPS origins). Origin checks reject cross-origin browser requests. State is isolated by browser session and mutations are serialized per user.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Health check |
| GET | `/api/state?date=YYYY-MM-DD` | Events, selected-day capacity, check-in and safe Google status |
| PUT | `/api/preferences` | `{ zone: "Asia/Kuala_Lumpur" }` |
| POST | `/api/events` | Create event: title, ISO start/end, optional category (`auto` default), isFlexible, consequence, deadline |
| PATCH / DELETE | `/api/events/:id` | Edit/delete local events; Google supports local classification/flexibility and approved remote time edits |
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

### Testing Google batching and recovery sessions

1. Restart the backend after building the frontend (`npm run build`, then `npm start` from the repository root).
2. Connect Google with write access and sync. Use two disposable future errands on the same date (e.g. Laundry 14:00–14:30 and Grocery 16:00–16:30), no attendees, flexible and low consequence.
3. Suggest a batch. Approve one move and verify only that event changed in Google. Approve the remaining move. A provider conflict/error leaves prior successes saved; sync and generate fresh suggestions if the provider event changed.
4. Open breathing and start a one-minute session. Finish all 60 seconds, wait for the saved message, then reload the dashboard: the completed-session streak should be 1 day. A second session on that date does not increase it to 2 days.
5. Start another session and stop early or close the pacer. No completion is recorded. An elapsed calendar block changes only the separate calendar streak.

Session API: `POST /api/recovery-sessions` with `{ technique: "calm" }` returns a session; `POST /api/recovery-sessions/:id/complete` validates elapsed time and saves once. State returns `capacity.recoveryStreak` (sessions) and `capacity.calendarRecoveryStreak` (calendar inference). Existing stored calendar data is preserved.

### Direct local-event upload

Create and save a local event, connect Google and enable write access, then click **Upload to Google** on that event. This explicitly approves uploading its title, description and time to the connected account's primary calendar. No .ics download is needed. Sync remains a read action; it does not bulk-upload local events. The upload converts the existing Moodify record to a linked Google event, preserving local classification/flexibility. Stable provider IDs prevent duplicate inserts on retries; sync also reconciles an upload whose response was lost. Existing Google event editing rules then apply. Imported .ics events are not eligible for this button.

`POST /api/events/:id/upload-google` requires `{ approved: true }`, an owned local event and Google write access. Uploads copy the chosen event as scheduled, including overlapping commitments; automatic scheduling conflict rules still apply to subsequent proposed moves.

Google-linked event dates and times can now be edited directly in the Calendar form. Saving changed times requires write access and sends an ETag-protected Google update; local state changes only after remote success. Conflicting Google calendar slots are rejected. Classification-only changes remain local and work with read-only access. The PATCH endpoint accepts `start`, `end` and `approved: true` for time changes. All-day events retain date-only, exclusive-end semantics. Google titles remain read-only in this form.
