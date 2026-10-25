# CampusCare AI — Implementation Plan

> Status: **Implemented** (Oct 2026). This is the original plan, kept for reference. Sections 1–10 describe what was _planned_; [section 11](#11-changes-from-the-original-plan) lists what changed during the build. For what actually works today see [docs/CHECKLIST.md](docs/CHECKLIST.md); for the real API see [docs/API.md](docs/API.md).

---

## 1. Current project state

| Item           | Finding                                                            |
| -------------- | ------------------------------------------------------------------ |
| Project folder | `campus routing/` is **completely empty** (no files, no git repo)  |
| Node.js / npm  | v20.20.2 / 10.8.2 — good, supports everything planned              |
| MongoDB        | **Not installed** (`mongod`, `mongosh` missing)                    |
| Docker         | Not installed                                                      |
| Homebrew       | Installed (`/opt/homebrew/bin/brew`) — can install MongoDB locally |
| Git            | 2.50.1 installed, but folder is not a repository yet               |
| Machine        | Apple M4, macOS 26, ~60 GB free                                    |

So we start from scratch. The one real blocker is **where MongoDB runs** (see "Decisions needed" at the bottom).

---

## 2. Architecture

### 2.1 Big picture

```
 Browser (React + Vite)                 Express API (Node + TS)                  MongoDB
┌──────────────────────┐  HTTPS/JSON  ┌─────────────────────────────┐  Mongoose ┌──────────┐
│ Student portal       │ ───────────▶ │ routes → middleware → svc   │ ────────▶ │ tickets  │
│ Staff / Admin dash   │ ◀─────────── │  auth · validate · ratelimit│           │ users …  │
└──────────────────────┘  httpOnly    │                             │           └──────────┘
                          JWT cookie  │  AI Agent pipeline ─────────┼──▶ Gemini API (optional)
                                      │  Notifier ──────────────────┼──▶ SMTP email (optional)
                                      │  Uploads (disk, validated)  │
                                      └─────────────────────────────┘
```

**Why this shape (simplest reliable option):**

- **One backend, one frontend, one database.** No microservices, queues or Redis — not needed at college-project scale.
- AI classification runs **inside the request** after the ticket is saved (the ticket is stored first, so an AI outage never loses a complaint).
- The stack is exactly what you asked for (React/TS/Vite, Tailwind, Express/TS, MongoDB, Gemini). The only additions are small, well-known libraries, listed below.

### 2.2 Libraries (and why)

| Area             | Library                                                                  | Purpose                                                                  |
| ---------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Validation       | `zod`                                                                    | One schema validates request bodies **and** AI JSON output               |
| DB               | `mongoose`                                                               | MongoDB models with types                                                |
| Auth             | `bcryptjs`, `jsonwebtoken`, `cookie-parser`                              | Password hashing, signed login tokens in httpOnly cookies                |
| Security         | `helmet`, `cors`, `express-rate-limit`                                   | Safe headers, allowed origins, rate limiting                             |
| Uploads          | `multer` + `file-type`                                                   | Upload handling + checks the file's real bytes, not just its extension   |
| AI               | `@google/genai`                                                          | Official Gemini SDK (JSON-schema output mode)                            |
| Email (optional) | `nodemailer`                                                             | Only used if SMTP vars are set                                           |
| Frontend data    | `@tanstack/react-query`                                                  | Gives us loading / error / empty states consistently                     |
| Routing          | `react-router-dom`                                                       | Pages                                                                    |
| Charts           | `recharts`                                                               | Admin dashboard charts                                                   |
| Styling          | `tailwindcss`                                                            | Consistent design tokens                                                 |
| Tests            | `vitest`, `supertest`, `mongodb-memory-server`, `@testing-library/react` | Unit, API integration, UI tests; tests use a throwaway in-memory MongoDB |

### 2.3 Folder structure (npm workspaces monorepo)

```
campus-routing/
├── package.json              # root: workspaces + "npm run dev" runs both apps
├── README.md
├── .env.example              # placeholders only
├── docs/
│   ├── API.md                # endpoint documentation
│   └── CHECKLIST.md          # final working-features / limitations list
├── shared/                   # code used by BOTH client and server
│   └── src/
│       ├── constants.ts      # categories, priorities, statuses, roles
│       └── schemas.ts        # zod schemas (complaint input, AI output…)
├── server/
│   ├── src/
│   │   ├── index.ts          # starts the server
│   │   ├── app.ts            # builds the Express app (imported by tests)
│   │   ├── config/env.ts     # reads + validates environment variables
│   │   ├── db/connect.ts
│   │   ├── models/           # User, Ticket, Department, Notification, …
│   │   ├── middleware/       # auth, requireRole, validate, rateLimit, upload, errorHandler
│   │   ├── routes/           # auth, tickets, admin, departments, notifications, settings
│   │   ├── services/
│   │   │   ├── ai/           # agent pipeline: classifier, geminiClient, fallbackClassifier, guard
│   │   │   ├── routing.service.ts
│   │   │   ├── duplicate.service.ts
│   │   │   ├── ticket.service.ts       # status state machine lives here
│   │   │   └── notification.service.ts
│   │   ├── utils/            # ticketId generator, logger, HttpError
│   │   └── seed/seed.ts      # DEMO data (clearly marked)
│   ├── uploads/              # git-ignored
│   └── tests/                # unit + integration
└── client/
    ├── src/
    │   ├── main.tsx, App.tsx
    │   ├── api/              # typed fetch wrappers
    │   ├── components/ui/    # Button, Card, Badge, Modal, Input, EmptyState, Spinner…
    │   ├── components/       # TicketTable, StatusTimeline, FiltersBar, Charts…
    │   ├── pages/student/    # SubmitComplaint, MyTickets, TicketDetail
    │   ├── pages/admin/      # Dashboard, Tickets, ReviewQueue, Duplicates, Departments, Settings
    │   ├── pages/auth/       # Login, Register
    │   ├── context/AuthContext.tsx
    │   └── hooks/
    └── tests/
```

---

## 3. Database schema (MongoDB collections)

### `users`

| Field                 | Type                            | Notes                             |
| --------------------- | ------------------------------- | --------------------------------- |
| `_id`                 | ObjectId                        |                                   |
| `name`                | string                          |                                   |
| `email`               | string, unique, lowercase       | login id                          |
| `passwordHash`        | string                          | bcrypt, **never returned by API** |
| `role`                | `student` \| `staff` \| `admin` |                                   |
| `department`          | ObjectId → departments          | staff only                        |
| `studentId`           | string?                         | roll number, private              |
| `createdAt/updatedAt` | Date                            |                                   |

### `departments`

| Field          | Type           | Notes                                              |
| -------------- | -------------- | -------------------------------------------------- |
| `name`         | string, unique | e.g. "IT Services"                                 |
| `code`         | string, unique | e.g. `IT`                                          |
| `contactEmail` | string?        | for email notifications                            |
| `categories`   | string[]       | **the configurable category → department mapping** |
| `active`       | boolean        |                                                    |

(One category maps to exactly one active department — enforced in the service layer. Admins edit this mapping in the UI.)

### `tickets`

| Field                  | Type                                                                           | Notes                                                        |
| ---------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| `ticketId`             | string, unique                                                                 | human-readable, e.g. `CC-2026-000042` (atomic counter)       |
| `student`              | ObjectId → users                                                               |                                                              |
| `title`, `description` | string                                                                         | length-limited                                               |
| `location`             | `{ building, room?, details? }`                                                |                                                              |
| `studentCategory`      | Category?                                                                      | what the student picked (if any)                             |
| `category`             | Category                                                                       | final category                                               |
| `priority`             | `Low`\|`Medium`\|`High`\|`Critical`                                            |                                                              |
| `status`               | `Submitted`\|`Under Review`\|`Assigned`\|`In Progress`\|`Resolved`\|`Reopened` |                                                              |
| `department`           | ObjectId?                                                                      |                                                              |
| `assignedTo`           | ObjectId → users?                                                              | staff member                                                 |
| `image`                | `{ filename, mimeType, size }`?                                                | stored on disk with a random name                            |
| `ai`                   | object                                                                         | see below                                                    |
| `routing`              | `{ method: 'auto'\|'manual'\|'admin_review', decidedBy?, reason, decidedAt }`  |                                                              |
| `needsReview`          | boolean                                                                        | uncertain / clarification / AI failure                       |
| `reviewReasons`        | string[]                                                                       | e.g. `low_confidence`, `ai_unavailable`, `critical_priority` |
| `dueAt`                | Date                                                                           | createdAt + SLA hours for priority                           |
| `resolvedAt`           | Date?                                                                          |                                                              |
| `statusHistory`        | `[{ from, to, by, note, at }]`                                                 | full audit trail                                             |
| `updates`              | `[{ author, authorRole, message, at }]`                                        | student/staff comments                                       |
| `createdAt/updatedAt`  | Date                                                                           |                                                              |

`ai` sub-document:

```
{
  source: 'gemini' | 'fallback_rules',   // honest about where the result came from
  model: string,
  category, priority, confidence (0–1),
  summary, extractedLocation, keyDetails: string[],
  categoryReason, priorityReason,
  needsClarification: boolean, clarificationQuestion?: string,
  rawValid: boolean,                     // did the JSON pass schema validation?
  processedAt: Date, error?: string
}
```

Indexes: `ticketId` (unique), `{ status, category }`, `{ department, status }`, `{ student, createdAt }`, `dueAt`, text index on `title + description` for search.

### `duplicateSuggestions`

| Field                      | Notes                                                                                     |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| `ticket`, `candidate`      | ObjectIds (new ticket, possible original)                                                 |
| `score`                    | 0–1 combined similarity                                                                   |
| `reasons`                  | e.g. `["same building", "text similarity 0.82", "same category"]`                         |
| `status`                   | `pending` \| `confirmed_duplicate` \| `not_duplicate`                                     |
| `reviewedBy`, `reviewedAt` | admin decision — **marking a duplicate only links tickets; nothing is deleted or merged** |

### `notifications`

| Field             | Notes                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------- |
| `user`, `ticket`  | recipients and context                                                                      |
| `type`            | `status_changed`, `assigned`, `update_added`, `clarification_requested` …                   |
| `message`, `read` | in-app display                                                                              |
| `email`           | `{ status: 'not_configured'\|'sent'\|'failed', error?, at }` — **real result, never faked** |

### `settings` (single document)

| Field                 | Default                                           |
| --------------------- | ------------------------------------------------- |
| `slaHours`            | `{ Critical: 4, High: 24, Medium: 72, Low: 168 }` |
| `autoRouteConfidence` | `0.75` (below → admin review)                     |
| `duplicateThreshold`  | `0.6`                                             |
| `duplicateWindowDays` | `30`                                              |

### `counters`

`{ _id: 'ticket-2026', seq: 42 }` — atomic `$inc` guarantees unique ticket IDs even under concurrent submissions.

---

## 4. API endpoint plan

All under `/api`. 🔓 = public, 🎓 = student, 🛠 = staff, 👑 = admin. All bodies validated with zod.

**Auth**

| Method | Path             | Who               | Purpose                                              |
| ------ | ---------------- | ----------------- | ---------------------------------------------------- |
| POST   | `/auth/register` | 🔓                | Student self-registration (role forced to `student`) |
| POST   | `/auth/login`    | 🔓 (rate-limited) | Sets httpOnly JWT cookie                             |
| POST   | `/auth/logout`   | any               | Clears cookie                                        |
| GET    | `/auth/me`       | any               | Current user                                         |

**Tickets**

| Method | Path                                | Who                        | Purpose                                                                                           |
| ------ | ----------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------- |
| POST   | `/tickets`                          | 🎓 (rate-limited)          | Create complaint (multipart, optional image) → runs AI pipeline → returns ticket incl. `ticketId` |
| GET    | `/tickets`                          | 🎓 own / 🛠 dept / 👑 all   | List + filters: `status, category, priority, department, overdue, needsReview, q, page, sort`     |
| GET    | `/tickets/:ticketId`                | owner / dept staff / admin | Detail incl. history; AI reasoning shown to staff/admin                                           |
| POST   | `/tickets/:ticketId/updates`        | owner / staff / admin      | Add comment or clarification answer                                                               |
| PATCH  | `/tickets/:ticketId/status`         | 🛠 / 👑                     | Change status (state machine enforced; `Resolved` requires `confirm: true` + resolution note)     |
| POST   | `/tickets/:ticketId/reopen`         | owner 🎓                   | Student reopens a resolved ticket (with reason)                                                   |
| PATCH  | `/tickets/:ticketId/assign`         | 👑                         | Assign/reassign department and/or staff member                                                    |
| PATCH  | `/tickets/:ticketId/classification` | 👑                         | Admin overrides category/priority (approves review)                                               |
| POST   | `/tickets/:ticketId/reclassify`     | 👑                         | Re-run AI (e.g. after clarification)                                                              |
| GET    | `/tickets/:ticketId/image`          | authorized viewers         | Streams image (not publicly reachable)                                                            |

**Admin**

| Method         | Path                               | Who             | Purpose                                                                               |
| -------------- | ---------------------------------- | --------------- | ------------------------------------------------------------------------------------- |
| GET            | `/admin/stats`                     | 👑 (🛠 scoped)   | Real aggregates: counts by status/category/priority/department, overdue, trend by day |
| GET            | `/admin/review-queue`              | 👑              | Tickets with `needsReview`                                                            |
| GET            | `/admin/duplicates`                | 👑              | Pending duplicate suggestions                                                         |
| PATCH          | `/admin/duplicates/:id`            | 👑              | Confirm / reject suggestion                                                           |
| GET/POST/PATCH | `/departments`, `/departments/:id` | 👑 (GET also 🛠) | Manage departments + category mapping                                                 |
| GET/POST       | `/admin/users`                     | 👑              | List users; create staff accounts                                                     |
| GET/PATCH      | `/settings`                        | 👑              | SLA hours, thresholds                                                                 |

**Notifications**

| Method | Path                                                 | Purpose                                       |
| ------ | ---------------------------------------------------- | --------------------------------------------- |
| GET    | `/notifications`                                     | Current user's notifications (+ unread count) |
| PATCH  | `/notifications/:id/read`, `/notifications/read-all` | Mark read                                     |

**Health**: `GET /api/health` → server + DB + AI-configured status (no secrets).

---

## 5. AI agent workflow

The "agent" is a **fixed, auditable pipeline**. The LLM only _suggests_; the backend _decides_.

```
Student submits
      │
 1. VALIDATE input (zod) + image checks ──── invalid → 400, nothing saved
      │
 2. SAVE ticket (status = Submitted)          ← complaint is never lost, even if AI fails
      │
 3. CLASSIFY
      ├─ Gemini configured? → prompt with complaint as quoted DATA, JSON-schema output mode, 10s timeout
      └─ else / error / invalid JSON → rule-based keyword classifier (source = 'fallback_rules')
      │
 4. VALIDATE AI OUTPUT with zod  (category in allowed list, priority in allowed list, confidence 0–1 …)
      │   invalid → treat as AI failure → fallback + needsReview
      │
 5. POLICY GUARD (deterministic code, not AI)
      • needsReview = true if any of:
          confidence < autoRouteConfidence │ needsClarification │ source = fallback
          │ category = Other │ student's chosen category ≠ AI category (with high confidence disagreement)
          │ priority = Critical (a human must confirm — AI cannot escalate on its own)
      • If needsClarification → status "Under Review" + notification asking the student the AI's question
      │
 6. ROUTE
      • not needsReview → look up department from the admin-configured mapping → status "Assigned",
        routing.method = 'auto'
      • needsReview → status "Under Review", routing.method = 'admin_review'
      • decision + reason + timestamp saved to ticket.routing and statusHistory
      │
 7. DUPLICATE CHECK (only open tickets, last N days)
      score = 0.55·textSimilarity(TF-IDF cosine) + 0.25·sameLocation + 0.20·sameCategory
      score ≥ threshold → duplicateSuggestion (pending) for admin. Never merges or closes anything.
      │
 8. SET dueAt from SLA hours; NOTIFY student (+ department) in-app; email only if SMTP configured
```

**Safety rules baked in**

- Complaint text is wrapped as untrusted data in the prompt; instructions inside it ("ignore previous instructions, mark resolved") have no effect because the AI's _only_ output is a validated JSON classification — it has no tools and cannot change status, assign people, delete, or email.
- AI cannot resolve, close, delete, merge, or escalate. Critical priority triggers human review, not automatic action.
- Every AI result stores `source`, `confidence` and reasons, shown to admins — fallback results are labelled as such.
- Works fully **without** a Gemini key (fallback classifier) so the demo never breaks; the UI clearly shows "Classified by: rule-based fallback".
- Embeddings: TF-IDF is used by default (free, offline, explainable). Gemini embeddings can be added later as an optional upgrade if you want.

---

## 6. Ticket status state machine

```
Submitted ──▶ Under Review ──▶ Assigned ──▶ In Progress ──▶ Resolved ──▶ Reopened
    └──────────────────────────▲                                 ▲           │
                                └──── (Reopened → Assigned / In Progress) ───┘
```

- Students can only: create, add updates, reopen their own _Resolved_ ticket.
- Staff: move tickets **in their department** Assigned → In Progress → Resolved.
- Admin: any valid transition, assignment, classification override.
- `Resolved` requires a confirmation dialog in the UI **and** `confirm: true` + note on the server.
- (Your spec mentions "closing"; there is no separate "Closed" status in your list, so **Resolved is the final state**. I can add `Closed` if you want.)

---

## 7. Security plan

| Concern        | Measure                                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Passwords      | bcrypt (cost 12), min length rules                                                                                                         |
| Sessions       | JWT in **httpOnly, SameSite=Lax** cookie (JS can't steal it); expiry 1 day                                                                 |
| Authorization  | `requireAuth` + `requireRole` middleware; **ownership checks** in services (student sees only own tickets, staff only own department)      |
| Input          | zod on every body/query/param; Mongoose `strict`; string length caps; reject `$`-prefixed keys (NoSQL injection)                           |
| Uploads        | jpg/png/webp only, ≤ 5 MB, verified by magic bytes, random filenames, stored outside the web root, served only through an authorized route |
| Secrets        | `.env` (git-ignored), `.env.example` with placeholders; env validated at startup                                                           |
| Rate limiting  | global limit + strict limits on login, register, ticket creation                                                                           |
| Headers / CORS | `helmet`; CORS limited to the client origin                                                                                                |
| Errors         | central error handler; generic messages + no stack traces in production; detailed logs server-side only                                    |
| Privacy        | dashboards show aggregates only; staff see student name but not email/student ID; no public pages expose student data                      |
| AI             | output schema-validated; AI has zero authority over actions (see §5)                                                                       |

---

## 8. Testing plan

| Layer              | Tool                                   | What's tested                                                                                                                                                                                                                                                       |
| ------------------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit (server)      | Vitest                                 | State machine transitions, policy guard, fallback classifier, TF-IDF similarity, ticket-ID generator, AI-output validation (good, malformed, malicious JSON)                                                                                                        |
| Integration (API)  | Vitest + Supertest + in-memory MongoDB | Register/login, role checks (student can't change status, staff can't see other depts), full submit → classify (Gemini **mocked**) → route → duplicate flow, upload rejection (wrong type / too big / fake extension), rate limit, resolve-without-confirm rejected |
| Frontend           | Vitest + React Testing Library         | Form validation & error display, loading/empty/error states, confirmation modal, role-based navigation                                                                                                                                                              |
| Manual demo script | README                                 | Step-by-step demo with seeded accounts                                                                                                                                                                                                                              |
| Optional E2E       | Playwright                             | Only if time allows (milestone 10)                                                                                                                                                                                                                                  |

Every milestone ends with `npm test` + typecheck (`tsc --noEmit`) + lint passing before moving on.

---

## 9. Milestone roadmap

| #       | Milestone                   | Deliverable you can see / test                                                                                                                                                            |
| ------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M0**  | Project setup               | git init, workspaces, TS configs, ESLint/Prettier, Vite + Tailwind starter, Express health route, `.env.example`, README skeleton. ✅ `npm run dev` shows a page that calls `/api/health` |
| **M1**  | Database + models + seed    | Mongoose models, counters, settings, **clearly-labelled demo seed** (departments, admin, staff, students). ✅ model unit tests                                                            |
| **M2**  | Authentication & roles      | Register/login/logout/me, middleware, rate limiting, login & register pages. ✅ auth integration tests                                                                                    |
| **M3**  | Ticket creation (no AI yet) | Complaint form, image upload validation, ticket IDs, "My tickets" list & detail page with history. ✅ upload + ownership tests                                                            |
| **M4**  | AI classification           | Gemini client, fallback classifier, zod validation, policy guard, clarification flow. ✅ tests with mocked Gemini incl. malformed/malicious outputs                                       |
| **M5**  | Routing + state machine     | Category→department mapping, auto-route vs review, status changes, confirmation for Resolved, reopen. ✅ transition tests                                                                 |
| **M6**  | Duplicate detection         | TF-IDF + location/category scoring, suggestions, admin review endpoints. ✅ similarity tests                                                                                              |
| **M7**  | Admin & staff dashboard     | Summary cards, charts (real aggregates), filters/search, review queue, duplicates page, assign/reassign, overdue view, departments + settings editors                                     |
| **M8**  | Notifications               | In-app bell + list; optional SMTP email with honest delivery status                                                                                                                       |
| **M9**  | Security hardening & polish | Security review pass, accessibility pass (labels, focus, contrast), responsive check, all UI states                                                                                       |
| **M10** | Docs & final QA             | README, `docs/API.md`, demo script, final checklist (working / limitations / remaining), optional Playwright E2E                                                                          |

After each milestone I'll stop, report what was built + test results, and explain the important files in beginner-friendly terms.

---

## 10. Decisions needed from you

1. **Where should MongoDB run?**
   - **(A) Local install via Homebrew** _(recommended)_ — `brew install mongodb-community`, runs offline, best for a live demo with no Wi-Fi risk.
   - (B) MongoDB Atlas free cloud cluster — no install, but you create the account and paste the connection string into `.env` yourself.
   - (Tests always use an in-memory MongoDB either way.)
2. **Gemini API key** — do you have one (free from Google AI Studio)? Not required to start; the app works with the rule-based fallback and I'll mock Gemini in tests.
3. **Email notifications** — attempt SMTP (e.g. a Gmail app password) in M8, or keep in-app only? Telegram I'd skip unless you specifically want it.
4. **"Closed" status** — keep Resolved as final (as specified), or add Closed?

**Decisions taken:** local MongoDB via Homebrew; no Gemini key yet (keyword fallback); in-app notifications with optional SMTP email; Resolved is the final status (no "Closed").

---

## 11. Changes from the original plan

| Area                   | Planned                                     | What was built                                                                                           | Why                                                                         |
| ---------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Milestone order        | M0 → M10 one after another                  | Frontend milestone built together with auth, tickets and stats backend                                   | No placeholder buttons: the screens needed a real backend (your choice)     |
| Department API         | `/api/departments`                          | `/api/admin/departments`                                                                                 | All admin and staff tools live under one protected router                   |
| Review queue           | `GET /admin/review-queue`                   | `GET /tickets?needsReview=true`                                                                          | Reuses the ticket list with its filters, search and pagination              |
| Re-run AI              | `POST /tickets/:id/reclassify`              | `POST /tickets/:id/reanalyze` (only while Under Review)                                                  | Prevents moving tickets that a department is already working on             |
| Staff accounts         | `GET/POST /admin/users`                     | Only `GET /admin/staff` (for assignment); staff are created by the seed                                  | Not needed for the demo; listed as remaining work (L5)                      |
| New tickets without AI | —                                           | Rule-based suggestion + always admin review                                                              | So that missing or failed AI never routes anything automatically            |
| AI output fields       | as planned                                  | Added `safetyRisk`; recommended department derived from the admin's map, not from the AI                 | The department must follow configurable rules, not model output             |
| Ticket field           | `classification` source admin / ai          | admin / ai / **rules**                                                                                   | Honest about where a suggestion came from                                   |
| Duplicates             | TF-IDF; embeddings maybe                    | TF-IDF with place words removed + location and category, ×0.7 for a different building; each pair once   | Free, offline and explainable; fixes double-counting found in testing       |
| Settings               | `duplicateThreshold`, `duplicateWindowDays` | `settings.duplicates.{threshold, windowDays}` and `settings.routing.{…}`                                 | Grouped and validated as a whole                                            |
| Notifications          | Email or Telegram if feasible               | In-app + optional SMTP email with the real delivery status; **no Telegram**                              | Email covers the need; Telegram would need a bot setup per user             |
| Real-time              | —                                           | Polling every 30 s                                                                                       | Simpler than WebSockets; enough for a help desk                             |
| Status set             | Six statuses, maybe "Closed"                | Six statuses; **Resolved is final**                                                                      | Your decision                                                               |
| Tests                  | Optional Playwright E2E                     | Not done; covered by API integration tests, UI component tests and manual browser runs                   | Time; listed as remaining work                                              |
| Server build           | —                                           | Server runs with `tsx` (no compile step)                                                                 | Simpler for a student project; listed under deployment                      |
| Toolchain              | Latest packages                             | Pinned versions that support Node 20 (vitest 4, jsdom 29, react-router 7, file-type 21); npm 11 required | Several latest packages require Node 22; npm 10.8 crashes on this workspace |

### Bugs found and fixed along the way (worth mentioning in a report)

- Production builds used React's development mode (Vite `loadEnv` picked up `NODE_ENV` from `.env`).
- Login didn't stick: the cache was cleared while the app was still watching it. Later, a slow first session check could overwrite a fresh login (race condition).
- After login, the app ignored the page you'd originally asked for.
- Oversized or unsupported request bodies returned 500 instead of 413/415.
- Duplicate pairs were suggested in both directions; the room number was counted twice in the score.
- The keyword classifier was fooled by "URGENT" and "these days", and missed water dripping onto a switchboard.
- The notification panel was cut off on phones.
- `.env.example` had an `APP_URL=` line that stopped a fresh setup from starting, and its placeholder `JWT_SECRET` was accepted as a real secret.
