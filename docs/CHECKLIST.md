# CampusCare AI: Final checklist

Status as of **25 Oct 2026**, branch `feature/final-docs` (includes PRs #1–#3).

**Automated checks:** 376 tests pass (341 server, 35 client). Typecheck, lint and the production build are clean.

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

| Feature                                                                                                                                  | Verified                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Category, priority, confidence, summary, key details, location, reasons, clarification                                                   | Auto, with a fake Gemini (`ai.pipeline.test.ts`, `ai.integration.test.ts`)                   |
| Strict schema check of every AI answer; invalid, malicious, slow or failing answers use the keyword fallback, and the reason is recorded | Auto (19 failure-mode tests, `ai.pipeline.test.ts`)                                          |
| Prompt-injection text can't change routing or status                                                                                     | Auto (`ai.pipeline.test.ts`, `ai.integration.test.ts`, `ai.rules.test.ts`)                   |
| Keyword fallback on 20 varied labelled complaints                                                                                        | Auto (`ai.rules.test.ts`); see limitation L2                                                 |
| Gemini API key never reaches the browser                                                                                                 | Manual (built with a fake key and searched the output) + Auto (settings response)            |
| **Real Gemini calls**                                                                                                                    | **Not verified**: no API key was available. Run `npm run ai:eval -w server` after adding one |

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

| Feature                                                                                                                   | Verified                                                        |
| ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Summary tiles (total, open, needs review, duplicates, overdue, average resolution time), all from the database            | Auto (`tickets.test.ts`, `duplicates.test.ts`) + Manual         |
| Charts: 14-day trend, by status, category, priority and department, each with hover tooltips and a "view as table" option | Manual                                                          |
| Search, filters (status, category, priority, department, overdue, needs review), sorting, pagination                      | Auto (`tickets.test.ts`, `validation.test.ts`) + Manual         |
| AI analysis and routing explanation on each ticket; re-run AI                                                             | Auto (`AiAnalysis.test.tsx`, `ai.integration.test.ts`) + Manual |
| Staff see a department-only dashboard                                                                                     | Auto (stats scope) + Manual                                     |

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

| Feature                                                                                            | Verified                                                          |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Role and ownership checks on **every endpoint × 6 kinds of user** (136 cases)                      | Auto (`authorization.test.ts`)                                    |
| Server-side validation of every input; database operators rejected; 413/415 for malformed bodies   | Auto (`validation.test.ts`, 54 cases)                             |
| Photo checks by file content, size limit, random names, private serving                            | Auto (`tickets.test.ts`)                                          |
| Rate limiting on login                                                                             | Auto (`auth.test.ts`)                                             |
| Same error for unknown email and wrong password; forged tokens rejected; deleted users lose access | Auto                                                              |
| Placeholder `JWT_SECRET` from `.env.example` refused at startup                                    | Manual (started the server with it: refused with a clear message) |
| No stack traces or internals in error responses                                                    | Auto                                                              |
| Dashboards show counts only; staff don't see student emails                                        | Auto (`tickets.test.ts`)                                          |

---

## 2. Known limitations

| #   | Limitation                                                                                                                                             | Impact / workaround                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| L1  | **Gemini has not been tested with a real key.** The default model name `gemini-2.5-flash` may be outdated.                                             | Add a key, run `npm run ai:eval -w server`, and change `GEMINI_MODEL` if needed                                                |
| L2  | The **keyword fallback was tuned on the same 20 examples** it's tested on (20/20).                                                                     | Expect lower accuracy on new complaints. By default all fallback results go to a human, so nothing is mis-routed automatically |
| L3  | **Duplicate scoring** was tuned on a handful of hand-written pairs.                                                                                    | Expect some false alarms and misses; an admin decides every case, and the threshold is adjustable                              |
| L4  | **Email not tested with a real provider.**                                                                                                             | Configure SMTP and try it; failures are shown honestly per notification                                                        |
| L5  | **No staff/admin account management.** Staff exist only through the seed script; there's no password reset or email verification.                      | Needed before real use                                                                                                         |
| L6  | Notifications **poll every 30 s**, so they aren't instant.                                                                                             | Fine for a campus help desk                                                                                                    |
| L7  | Photos are stored on the **server's disk**, with no virus scanning or cleanup.                                                                         | Use cloud storage for a real deployment                                                                                        |
| L8  | Rate limits are **in-memory**: they reset on restart and assume one server.                                                                            | Use a shared store for several servers                                                                                         |
| L9  | **No production deployment set-up**: no HTTPS configuration and no server build step (the server runs with `tsx`).                                     | Fine locally and for a demo                                                                                                    |
| L10 | **No automatic checks on GitHub (CI).**                                                                                                                | A proposed task exists to add GitHub Actions                                                                                   |
| L11 | Accessibility checked through tests and by hand (labels, focus, keyboard dialogs, table views for charts), but **no full screen-reader or axe audit**. |                                                                                                                                |
| L12 | Students **can't edit or withdraw** a complaint after submitting.                                                                                      | They can add updates                                                                                                           |
| L13 | Overdue tickets are **highlighted but not escalated** (no automatic reminder).                                                                         |                                                                                                                                |
| L14 | With a Gemini key set, **complaint text and location are sent to Google**.                                                                             | Mention it in a privacy notice                                                                                                 |
| L15 | **Light theme only**; dates are shown in Indian English format and the server's time zone.                                                             |                                                                                                                                |

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
9. **Accessibility audit** with axe and a screen reader (L11).

---

## 4. Changes from the original plan

See the "Changes from the original plan" section in [PLAN.md](../PLAN.md#11-changes-from-the-original-plan).
