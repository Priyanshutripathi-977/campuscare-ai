# CampusCare AI: Final checklist

Status as of **25 Oct 2026**, branch `fix/audit` (includes PRs #1–#4 and the audit fixes in section 5).

**Automated checks:** 392 tests pass (356 server, 36 client). Typecheck, lint and the production build are clean.

What "Verified" means in this document:

- **Auto**: an automated test proves it (file in brackets).
- **Manual**: checked by hand in the running app, in a browser.
- **Not verified**: built, but not proven against the real external service.

---

## 1. Working features

### Student portal

| Feature                                                                                 | Verified                                                                 |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Register (always as _student_), log in, log out                                         | Auto (`auth.test.ts`, `LoginPage.test.tsx`) + Manual                     |
| Submit a complaint with title, description, location, optional category, optional photo | Auto (`tickets.test.ts`, `NewComplaintPage.test.tsx`) + Manual           |
| Form validation in the browser _and_ on the server, with errors next to each field      | Auto (`validation.test.ts`, `NewComplaintPage.test.tsx`) + Manual        |
| Unique ticket ID shown after submission (`CC-2026-000042`)                              | Auto (incl. 20 simultaneous submissions, `persistence.test.ts`) + Manual |
| "My complaints" list with search, filters and pagination; empty and error states        | Auto (`MyTicketsPage.test.tsx`) + Manual                                 |
| Ticket page: details, photo, status history, conversation                               | Manual                                                                   |
| Add updates; answer an AI clarification question (the ticket is re-analysed)            | Auto (`ai.integration.test.ts`) + Manual                                 |
| Reopen a resolved ticket with a reason (owner only)                                     | Auto (`tickets.test.ts`, `persistence.test.ts`)                          |

### AI complaint understanding

| Feature                                                                                                                                     | Verified                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Category, priority, confidence, summary, key details, location, reasons, clarification                                                      | Auto, with a fake Gemini (`ai.pipeline.test.ts`, `ai.integration.test.ts`)                   |
| Strict schema check of every AI answer; invalid, malicious, slow or failing answers use the keyword fallback, and the reason is recorded    | Auto (19 failure-mode tests, `ai.pipeline.test.ts`)                                          |
| Prompt-injection text can't change routing or status                                                                                        | Auto (`ai.pipeline.test.ts`, `ai.integration.test.ts`, `ai.rules.test.ts`)                   |
| Keyword fallback on 20 varied labelled complaints                                                                                           | Auto (`ai.rules.test.ts`); see limitation L2                                                 |
| Gemini API key never reaches the browser                                                                                                    | Manual (built with a fake key and searched the output) + Auto (settings response)            |
| Our Gemini code with the **real SDK over HTTP** (request format, no student identity sent, HTTP 429/403/400/503, blocked answers, timeouts) | Auto, against a local fake Gemini server (`gemini.sdk.test.ts`)                              |
| **Real Gemini calls (Google's servers)**                                                                                                    | **Not verified**: no API key was available. Run `npm run ai:eval -w server` after adding one |

### Routing and tickets

| Feature                                                                                    | Verified                                                                             |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Configurable category → department map, with no category in two departments                | Auto (`ai.integration.test.ts`, `validation.test.ts`) + Manual                       |
| Auto-route only when every rule passes; otherwise the review queue with reasons            | Auto (`routing.policy.test.ts`, `ai.integration.test.ts`)                            |
| Admin-editable rules (confidence threshold, Critical review, review categories, deadlines) | Auto + Manual (Settings page)                                                        |
| Routing decision stored with method, reason, who and when                                  | Auto (`persistence.test.ts`) + Manual                                                |
| Manual assign/reassign; access moves to the new department; status kept                    | Auto (`persistence.test.ts`) + Manual                                                |
| Six statuses, only allowed changes per role, resolve needs a note **and** confirmation     | Auto (`state-machine.test.ts`, `tickets.test.ts`, `StatusActions.test.tsx`) + Manual |
| Full status history (from, to, who, note, time), in order                                  | Auto (`persistence.test.ts`) + Manual                                                |
| Simultaneous status changes: one wins, the other gets 409, history stays consistent        | Auto (`persistence.test.ts`)                                                         |
| Overdue detection from the stored deadline; resolved tickets never overdue                 | Auto (`persistence.test.ts`, `tickets.test.ts`) + Manual                             |

### Duplicates

| Feature                                                                                                  | Verified                                                        |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Similar open complaints suggested (text + location + category) with reasons                              | Auto (`similarity.test.ts`, `duplicates.test.ts`) + Manual      |
| Each pair suggested once (newer → older); time window and threshold configurable                         | Auto (`duplicates.test.ts`)                                     |
| Admin confirm/dismiss; confirming only links the tickets and tells the student; nothing merged or closed | Auto (`duplicates.test.ts`, `DuplicatesPage.test.tsx`) + Manual |

### Admin dashboard

| Feature                                                                                                                   | Verified                                                                          |
| ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Summary tiles (total, open, needs review, duplicates, overdue, average resolution time), all from the database            | Auto (`tickets.test.ts`, `duplicates.test.ts`) + Manual                           |
| Charts: 14-day trend, by status, category, priority and department, each with hover tooltips and a "view as table" option | Manual                                                                            |
| Search, filters (status, category, priority, department, overdue, needs review), sorting, pagination                      | Auto (`tickets.test.ts`, `validation.test.ts`) + Manual                           |
| AI analysis and routing explanation on each ticket; re-run AI                                                             | Auto (`AiAnalysis.test.tsx`, `ai.integration.test.ts`) + Manual                   |
| Staff see a department-only dashboard                                                                                     | Auto (stats scope) + Manual                                                       |
| Staff send a misrouted ticket back to an admin (reason required; admins notified)                                         | Auto (`authorization.test.ts`, `notifications.test.ts`, `StatusActions.test.tsx`) |
| Complete journeys: submission → AI → routing → assignment → staff → student tracking                                      | Auto (`journey.test.ts`, 3 journeys) + Manual (section 5)                         |

### Notifications

| Feature                                                                                                         | Verified                                                          |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| In-app notifications for routing, assignment, status, replies, reopen, clarification, duplicate link, send-back | Auto (`notifications.test.ts`) + Manual                           |
| The person who acted is never notified; other departments get nothing                                           | Auto                                                              |
| Bell with unread count, dropdown, Notifications page, mark one/all as read                                      | Auto (`NotificationBell.test.tsx`) + Manual (desktop and phone)   |
| Email over SMTP, with the real result stored (sent / failed + reason / in-app only)                             | Auto: real SMTP to a local test server, plus a refused connection |
| A notification or email failure never breaks the action                                                         | Auto                                                              |
| **Email via a real provider (e.g. Gmail)**                                                                      | **Not verified**: needs your own SMTP account                     |

### Security

| Feature                                                                                                             | Verified                                                          |
| ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Role and ownership checks on **every endpoint × 6 kinds of user** (22 × 6 = 132 cases, plus 5 role-tampering tests) | Auto (`authorization.test.ts`)                                    |
| Server-side validation of every input; database operators rejected; 413/415 for malformed bodies                    | Auto (`validation.test.ts`, 54 cases)                             |
| Photo checks by file content, size limit, random names, private serving                                             | Auto (`tickets.test.ts`)                                          |
| Rate limiting on login                                                                                              | Auto (`auth.test.ts`)                                             |
| Same error for unknown email and wrong password; forged tokens rejected; deleted users lose access                  | Auto                                                              |
| Placeholder `JWT_SECRET` from `.env.example` refused at startup                                                     | Manual (started the server with it: refused with a clear message) |
| No stack traces or internals in error responses                                                                     | Auto                                                              |
| Dashboards show counts only; staff don't see student emails                                                         | Auto (`tickets.test.ts`)                                          |

---

## 2. Known limitations

| #   | Limitation                                                                                                                                                                                                                                       | Impact / workaround                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| L1  | **Gemini has not been tested with a real key.** The default model name `gemini-2.5-flash` may be outdated.                                                                                                                                       | Add a key, run `npm run ai:eval -w server`, and change `GEMINI_MODEL` if needed                                                |
| L2  | The **keyword fallback was tuned on the same 20 examples** it's tested on (20/20).                                                                                                                                                               | Expect lower accuracy on new complaints. By default all fallback results go to a human, so nothing is mis-routed automatically |
| L3  | **Duplicate scoring** was tuned on a handful of hand-written pairs.                                                                                                                                                                              | Expect some false alarms and misses; an admin decides every case, and the threshold is adjustable                              |
| L4  | **Email not tested with a real provider.**                                                                                                                                                                                                       | Configure SMTP and try it; failures are shown honestly per notification                                                        |
| L5  | **No staff/admin account management.** Staff exist only through the seed script; there's no password reset or email verification.                                                                                                                | Needed before real use                                                                                                         |
| L6  | Notifications **poll every 30 s**, so they aren't instant.                                                                                                                                                                                       | Fine for a campus help desk                                                                                                    |
| L7  | Photos are stored on the **server's disk**, with no virus scanning or cleanup.                                                                                                                                                                   | Use cloud storage for a real deployment                                                                                        |
| L8  | Rate limits are **in-memory**: they reset on restart and assume one server.                                                                                                                                                                      | Use a shared store for several servers                                                                                         |
| L9  | **No production deployment set-up**: no HTTPS configuration and no server build step (the server runs with `tsx`).                                                                                                                               | Fine locally and for a demo                                                                                                    |
| L10 | **No automatic checks on GitHub (CI).**                                                                                                                                                                                                          | A proposed task exists to add GitHub Actions                                                                                   |
| L11 | Accessibility: **every page passed an automated axe scan** (WCAG 2.1 A/AA) at 1024 px and 375 px, but **no manual screen-reader test** was done, and the chart keyboard fix has no automated test (charts don't render in the test environment). |                                                                                                                                |
| L12 | Students **can't edit or withdraw** a complaint after submitting.                                                                                                                                                                                | They can add updates                                                                                                           |
| L13 | Overdue tickets are **highlighted but not escalated** (no automatic reminder).                                                                                                                                                                   |                                                                                                                                |
| L14 | With a Gemini key set, **complaint text and location are sent to Google**.                                                                                                                                                                       | Mention it in a privacy notice                                                                                                 |
| L15 | **Light theme only**; dates are shown in Indian English format and the server's time zone.                                                                                                                                                       |                                                                                                                                |

---

## 3. Remaining tasks (suggested order)

1. **Merge the pull requests in order:** #1 → #2 → #3 → this one, using "Create a merge commit".
2. **Add a Gemini key** and run `npm run ai:eval -w server`. Adjust the confidence threshold on the Settings page based on the results (L1, L2).
3. **Add CI** (GitHub Actions running tests, typecheck, lint and build) (L10).
4. **Staff and admin account management** (admin creates staff, password reset) (L5).
5. **Configure SMTP** and test real email (L4).
6. **Deployment:** MongoDB Atlas, HTTPS, compiled server, cloud photo storage (L7–L9).
7. **Overdue escalation:** notify the department and admins when a deadline passes (L13).
8. **Browser end-to-end tests** (e.g. Playwright) for the main flows.
9. **Screen-reader test** (VoiceOver/NVDA) of the main flows (L11).

---

## 4. Changes from the original plan

See the "Changes from the original plan" section in [PLAN.md](../PLAN.md#11-changes-from-the-original-plan).

---

## 5. Audit (25 Oct 2026)

A full audit against the original requirements: every check run, the complete flow tested by hand, and automated accessibility scans.

**Checks:** 0 type errors · lint clean · 353/353 server tests · 36/36 client tests · production build OK.

**Manual end-to-end run (real app, no Gemini key):**

1. Student submits with an empty form, gets field errors, and focus moves to the first one. Submits properly and gets `CC-2026-000071`.
2. The keyword fallback suggests Classroom Facilities / Medium → Academic Facilities. The ticket is **Under Review** with its reasons, routing explanation, timestamp and 72 h deadline, checked directly in MongoDB. No duplicate is suggested (the other projector ticket is in a different room).
3. Admin finds it in the review queue, confirms priority **High** (deadline becomes 24 h), and assigns it to Joseph Thomas. Method shown: _Manual (administrator)_.
4. Joseph sees a notification and only **Start work** / **Send back for review**. Starts work.
5. The student sees **In Progress**, the history Submitted → Under Review → Assigned → In Progress, and two notifications.

Resolve and reopen were not repeated by hand in this run; they are covered by `journey.test.ts`, `persistence.test.ts` and the earlier manual runs.

**New tests:** `gemini.sdk.test.ts` (8, real SDK against a local fake Gemini server) and `journey.test.ts` (3 complete journeys checked in the database), plus tests for the fixes below.

**Problems found and fixed:**

| Problem                                                                                                                     | Fix                                                                                                      |
| --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Staff couldn't send a misrouted ticket back to an admin; the README promised it and contradicted itself                     | Allowed for staff on their own department's tickets, with a required reason; admins are notified         |
| Accessibility (serious): dashboard charts hidden from screen readers could still be focused with Tab                        | Turned off the chart library's keyboard layer; the "view as table" option remains the accessible version |
| Accessibility (serious): grey placeholder text at a 2.63:1 contrast ratio (ticket table, notifications, input placeholders) | Darker grey (≥ 4.5:1)                                                                                    |
| Accessibility (serious): notification details on the unread background at 4.45:1                                            | Darker grey                                                                                              |
| Test-setup mistake: one test run sent a few requests to Google's real API with a dummy key                                  | Tests now always use the local fake server                                                               |

**Accessibility scan:** axe-core, WCAG 2.1 A/AA, run in a real browser. Every page has **0 violations** after the fixes, at 1024 px and 375 px, with no horizontal scrolling:

- login;
- student: My complaints, Report a problem (including with errors showing), confirmation, ticket page, Notifications;
- staff: dashboard and ticket page;
- admin: dashboard, all tickets, review queue, ticket page, Duplicates, Settings, Notifications.

---

## 6. Documented commands: verified 25 Oct 2026

Run on macOS 26 (Apple M4), Node 20.20.2, npm 11.21.1, MongoDB 9.0 (Homebrew). Exit code 0 = success.

| Command (as written in README / DEMO / API docs)                                                                                                                                                 | Result                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `node -v` / `npm -v`                                                                                                                                                                             | v20.20.2 / 11.21.1                                                                                                                                                                                                       |
| `brew services list` (MongoDB)                                                                                                                                                                   | `mongodb-community started`                                                                                                                                                                                              |
| `npm install`                                                                                                                                                                                    | exit 0 ("up to date"); a fresh install on a clean copy was also verified during the final-documentation step                                                                                                             |
| `cp .env.example .env` with the placeholder secret left in                                                                                                                                       | Server **refuses to start** with a clear JWT_SECRET message (intended)                                                                                                                                                   |
| `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`                                                                                                                       | 96-character secret                                                                                                                                                                                                      |
| `npm run typecheck` / `npm run lint` / `npm run format`                                                                                                                                          | exit 0 / exit 0 / exit 0 (no changes needed)                                                                                                                                                                             |
| `npm test`                                                                                                                                                                                       | exit 0: 356 server + 36 client tests pass                                                                                                                                                                                |
| `npm run build`                                                                                                                                                                                  | exit 0                                                                                                                                                                                                                   |
| `npm run seed -w server` / `npm run seed -w server -- --reset`                                                                                                                                   | exit 0: 7 departments, 9 accounts, 15 tickets, 1 duplicate suggestion. After the reset fix, the database holds exactly the 15 demo tickets and **0** tickets or notifications pointing at deleted users (`seed.test.ts`) |
| `npm run ai:eval -w server`                                                                                                                                                                      | exit 0: keyword fallback 20/20 category, 20/20 priority, 2/2 vague flagged (no Gemini key)                                                                                                                               |
| `npm run dev` + `curl -s http://localhost:4000/api/health`                                                                                                                                       | `{"status":"ok","database":"connected","aiConfigured":false,…}`                                                                                                                                                          |
| `bash scripts/api-walkthrough.sh`                                                                                                                                                                | Full flow OK. Security checks returned 403 / 404 / 401 as expected                                                                                                                                                       |
| Demo script claims (classifier output for the demo complaint, the scanner override at 38%, Neha's clarification question, the chemistry-smell example, the 81% duplicate pair, quoted UI labels) | Checked against the code, the database and the running app                                                                                                                                                               |

**Not verified:**

- `brew install …` (MongoDB was already installed earlier in the project).
- The Windows/Linux notes.
- Commands that need your credentials: a real `GEMINI_API_KEY`, real SMTP settings.

**Bug found while verifying (fixed):** `--reset` deleted the demo accounts but not the tickets and notifications those accounts had created while practising. That left 4 tickets and 8 notifications pointing at users that no longer existed. The reset now removes everything created with demo accounts (tickets, photos, notifications, duplicate suggestions) and unassigns demo staff from real tickets. Real users' data is kept, as `seed.test.ts` proves.
