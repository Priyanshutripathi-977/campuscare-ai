# CampusCare AI

A web app where **students report campus problems** (broken fans, Wi-Fi outages, leaks, safety issues…) and the system **understands, prioritises and routes** each complaint to the right department, **flags likely duplicates**, and **tracks every ticket to resolution** with notifications along the way.

AI suggests; plain, tested rules decide. A complaint is never lost if the AI fails, and the AI can never close, delete or escalate anything on its own.

| Document                               | What's in it                                                             |
| -------------------------------------- | ------------------------------------------------------------------------ |
| [docs/CHECKLIST.md](docs/CHECKLIST.md) | What works (and how it was verified), known limitations, remaining tasks |
| [docs/DEMO.md](docs/DEMO.md)           | A 10-minute presentation script                                          |
| [docs/API.md](docs/API.md)             | Every API endpoint, who may call it, and what it returns                 |
| [PLAN.md](PLAN.md)                     | Original architecture, database design and roadmap, plus what changed    |

---

## Features

**Students**: report a problem (with an optional photo) and get a ticket ID; follow its status history; chat with staff on the ticket; answer clarification questions; reopen a ticket that wasn't really fixed.

**AI understanding**: category, priority, a one-line summary, key details, location and short reasons for each complaint, using Google Gemini (optional) with a built-in keyword classifier as fallback. Every AI answer is checked against a strict schema before it is used.

**Routing**: confident, non-critical complaints go straight to the mapped department. Anything uncertain (low confidence, Critical, vague, "Other", unmapped, or the student disagrees) waits in the admin **review queue** with the reasons listed.

**Staff**: see only their department's tickets; start work; resolve with a note and an explicit confirmation; reply; send a ticket back for review.

**Admins**: campus dashboard with live charts; search and filters; review queue and overdue list; confirm or override the category and priority; assign or reassign; review duplicate suggestions; edit routing rules, deadlines and the category → department map.

**Duplicates**: new complaints are compared with recent open ones (text, location, category). Likely repeats are suggested to admins with a match score and reasons. Confirming only links the tickets; nothing is merged, closed or deleted.

**Notifications**: an in-app bell (and optional email) for routing, status changes, replies, reopening, clarification requests and duplicate links. Each notification records whether its email was really sent.

**Security**: login with httpOnly cookies, roles checked on every request, ownership and department checks, validation on the server, image checks by file content, rate limits, safe error messages, and no secrets sent to the browser.

---

## Tech stack

| Part       | Technology                                                                         |
| ---------- | ---------------------------------------------------------------------------------- |
| Frontend   | React 19 + TypeScript + Vite, Tailwind CSS, TanStack Query, React Router, Recharts |
| Backend    | Node.js 20 + Express 5 + TypeScript (run with `tsx`)                               |
| Database   | MongoDB + Mongoose                                                                 |
| Validation | zod, with the same rules shared by browser and server                              |
| AI         | Google Gemini via `@google/genai` (optional), keyword fallback                     |
| Email      | nodemailer over SMTP (optional)                                                    |
| Tests      | Vitest, Supertest, mongodb-memory-server, React Testing Library, smtp-server       |

---

## 1. Install (once)

You need **Node.js 20.19+**, **npm 11** and **MongoDB**.

```bash
node -v
```

npm 10.8 crashes when installing this project (`Cannot read properties of null (reading 'edgesOut')`). Upgrade it once:

```bash
npm install -g npm@11
```

MongoDB on macOS with Homebrew:

```bash
brew tap mongodb/brew
```

```bash
brew trust mongodb/brew
```

```bash
brew install mongodb-community
```

```bash
brew services start mongodb/brew/mongodb-community
```

(Or create a free MongoDB Atlas cluster and put its connection string in `MONGODB_URI` below.)

Then, inside the project folder:

```bash
npm install
```

## 2. Configure

```bash
cp .env.example .env
```

Generate a secret for signing logins and paste it into `.env` as `JWT_SECRET=...`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

The server **refuses to start** if `JWT_SECRET` is missing, too short, or still the placeholder from `.env.example`.

| Variable                                                        | Required? | Default                                | What it does                                                                    |
| --------------------------------------------------------------- | --------- | -------------------------------------- | ------------------------------------------------------------------------------- |
| `JWT_SECRET`                                                    | **yes**   | —                                      | Signs login cookies. Long, random, never shared.                                |
| `MONGODB_URI`                                                   | no        | `mongodb://127.0.0.1:27017/campuscare` | Database address                                                                |
| `API_PORT`                                                      | no        | `4000`                                 | Port of the Express API                                                         |
| `CLIENT_ORIGIN`                                                 | no        | `http://localhost:5173`                | The website's address (CORS, email links)                                       |
| `GEMINI_API_KEY`                                                | no        | empty                                  | Turns on Gemini. Empty = keyword fallback (all complaints reviewed by an admin) |
| `GEMINI_MODEL`                                                  | no        | `gemini-2.5-flash`                     | Which Gemini model to call                                                      |
| `AI_TIMEOUT_MS`                                                 | no        | `12000`                                | How long to wait for Gemini before falling back                                 |
| `MAX_UPLOAD_MB`                                                 | no        | `5`                                    | Photo size limit                                                                |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | no        | empty                                  | Turns on email notifications. Empty = in-app only                               |
| `APP_URL`                                                       | no        | `CLIENT_ORIGIN`                        | Base address used for links in emails                                           |

All of these are read **only by the server**. The browser is only ever told _whether_ AI and email are switched on.

## 3. Load demo data (optional, recommended for a demo)

```bash
npm run seed -w server
```

This creates **demo data, clearly labelled** "Demo data" in the app: 7 departments with their category mapping, 9 accounts, 14 sample tickets in every status, and one duplicate pair. To delete and recreate _only_ the demo data:

```bash
npm run seed -w server -- --reset
```

| Role               | Email                              | Password    |
| ------------------ | ---------------------------------- | ----------- |
| Admin              | `admin@campuscare.test`            | `Demo@1234` |
| Student            | `student@campuscare.test`          | `Demo@1234` |
| Student            | `neha@campuscare.test`             | `Demo@1234` |
| Staff (Electrical) | `electrical.staff@campuscare.test` | `Demo@1234` |
| Staff (IT)         | `it.staff@campuscare.test`         | `Demo@1234` |

Other staff: `plumbing.staff@`, `housekeeping.staff@`, `academic.staff@` and `security.staff@` (all `@campuscare.test`). These are demo-only passwords; never reuse them. The seed refuses to run when `NODE_ENV=production`.

## 4. Run

```bash
npm run dev
```

This starts the API (port 4000) and the website together. Open **http://localhost:5173**. The "System status" card on the login page should say **API server: Online** and **Database: Connected**. Press **Ctrl + C** to stop.

---

## Useful commands

| Command                     | What it does                                                                                       |
| --------------------------- | -------------------------------------------------------------------------------------------------- |
| `npm run dev`               | Start API + website with auto-reload                                                               |
| `npm test`                  | Run all 376 automated tests (server + client)                                                      |
| `npm run typecheck`         | Check TypeScript types in every package                                                            |
| `npm run lint`              | Find code-quality problems                                                                         |
| `npm run format`            | Auto-format all code                                                                               |
| `npm run build`             | Production build of the website into `client/dist`                                                 |
| `npm run seed -w server`    | Load demo data (`-- --reset` to recreate it)                                                       |
| `npm run ai:eval -w server` | Measure the classifier on 20 labelled complaints (uses Gemini if a key is set; about 20 API calls) |

---

## How it works

### A request, step by step

1. The browser loads the React app from Vite (`localhost:5173`).
2. React calls `/api/...`. Vite's **proxy** forwards it to Express on port 4000, so the browser sees one website and login cookies just work.
3. Express runs the request through **middleware**: security headers, CORS, body parsing, rate limits, then `requireAuth` (who are you?) and `requireRole` (are you allowed?).
4. The **route** validates the input with zod, then calls a **service** that holds the business rules (ownership, the status state machine, routing).
5. The service reads and writes MongoDB through **Mongoose models** and returns a **DTO**, a JSON shape that contains only what that role may see.
6. Errors become safe JSON messages in `errorHandler.ts`, with no stack traces sent to users.

### What happens when a complaint is submitted

```
validate input ─► save ticket ("Submitted") ─► AI analysis ─► validate AI JSON ─► routing rules ─► duplicate check ─► notify
                       │                         │ fails/invalid/slow                │
                       │                         └─► keyword fallback (reason saved)  ├─ all rules pass ─► "Assigned" to the mapped department
     never lost ◄──────┘                                                              └─ any doubt      ─► "Under Review" + reasons for the admin
```

### Ticket statuses

```
Submitted → Under Review → (admin assigns) → Assigned → In Progress → Resolved → Reopened
```

Staff can only _start work_, _resolve_ (needs a note **and** a ticked confirmation) and _continue a reopened ticket_. Admins can also send tickets back for review. Only the student who reported a ticket can reopen it. Every change is stored with who, when and an optional note.

**Overdue** means the stored deadline (submission time + the hours set for its priority) has passed and the ticket is not resolved. It is worked out each time it's shown, so it can never be out of date.

---

## Project structure

```
campus routing/
├── shared/src/                 Rules used by BOTH browser and server
│   ├── constants.ts            categories, priorities, statuses, roles, allowed status changes
│   ├── schemas.ts              zod validation for every form/request
│   ├── ai.ts                   the AI answer schema + routing/duplicate settings
│   └── types.ts                shapes of the JSON the API returns
├── server/src/                 Express API
│   ├── index.ts                starts the server (connects to MongoDB first)
│   ├── app.ts                  middleware + routes (tests import this directly)
│   ├── config/env.ts           reads and checks .env, refusing bad values
│   ├── middleware/             auth.ts (login + roles), upload.ts (photo checks), rateLimit.ts, errorHandler.ts
│   ├── models/                 MongoDB collections: User, Ticket, Department, Settings, DuplicateSuggestion, Notification, Counter
│   ├── routes/                 auth, tickets, admin, notifications: URL → validation → service
│   ├── services/
│   │   ├── ticket.service.ts   creating, viewing, status changes, assigning (all permission checks)
│   │   ├── ticket.dto.ts       what each role is allowed to SEE
│   │   ├── ai/                 Gemini call, prompt, keyword fallback, validation pipeline, 20-complaint test set
│   │   ├── routing.service.ts  the rules that decide auto-route vs. review
│   │   ├── similarity.ts       TF-IDF text + location similarity
│   │   ├── duplicate.service.ts finding and deciding duplicate suggestions
│   │   ├── notification.service.ts + mailer.ts   who to notify, email delivery
│   │   └── stats.service.ts    dashboard numbers (one database aggregation)
│   ├── seed/                   demo data (clearly flagged)
│   └── scripts/evalAi.ts       AI accuracy report
├── server/tests/               API tests on a throwaway in-memory MongoDB
├── client/src/                 React website
│   ├── api/                    one function per API call
│   ├── context/AuthContext.tsx who is logged in
│   ├── components/ui/          Button, Field, Modal, Alert, Card, loading/empty/error states
│   ├── components/tickets/     badges, list/table, filters, timeline, status/assign/reopen actions, AI + duplicates panels
│   ├── components/charts/      dashboard charts (each with a "view as table" option)
│   ├── components/notifications/ the bell and notification items
│   └── pages/                  login, register, student pages, ticket page, admin dashboard/tickets/duplicates/settings, notifications
├── client/tests/               UI tests
├── docs/                       API reference, checklist, demo script
├── .env.example                settings template (placeholders only, safe to commit)
└── .env                        YOUR settings (git-ignored, never commit)
```

---

## Security summary

| Risk                              | What the app does                                                                                                                                                                   |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stolen login                      | httpOnly, SameSite=Lax cookie (page scripts can't read it); 1-day expiry; the user is re-checked on every request                                                                   |
| Wrong person sees or changes data | `requireRole` and ownership/department checks in services; other people's tickets return **404** (we don't reveal that they exist). Tested for **every endpoint × 6 kinds of user** |
| Bad or malicious input            | zod validation on every body, query and parameter; length limits; database operator objects rejected                                                                                |
| Dangerous uploads                 | jpg/png/webp only, checked by **file content**; ≤ 5 MB; random file names; served only to people who may see the ticket                                                             |
| Password guessing / spam          | Rate limits on login, registration and complaint submission                                                                                                                         |
| AI misuse / prompt injection      | The AI has no tools; its output is schema-validated; plain-code rules decide routing; Critical always needs a human (default)                                                       |
| Leaking secrets                   | API keys and SMTP settings stay on the server (verified once by building with a fake key and searching the output); the placeholder JWT secret is refused                           |
| Privacy                           | Dashboards show only counts; staff see a student's name, not their email; Gemini receives only the complaint text and location                                                      |

---

## Troubleshooting

| Message                                                              | Fix                                                                                        |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `Could not connect to MongoDB`                                       | MongoDB isn't running: `brew services start mongodb/brew/mongodb-community`                |
| `Invalid environment variables`                                      | A value in `.env` is wrong; the message names it (e.g. `JWT_SECRET` still the placeholder) |
| `Port 5173 is in use` / `EADDRINUSE`                                 | Another copy is already running; stop it first                                             |
| `Cannot read properties of null (reading 'edgesOut')` during install | Upgrade npm: `npm install -g npm@11`                                                       |
| Logged out after `npm run seed -- --reset`                           | Expected: demo accounts were recreated. Log in again                                       |
| AI card says "Keyword fallback"                                      | No `GEMINI_API_KEY`, or Gemini failed (the card shows why)                                 |

**Health check:** `GET http://localhost:4000/api/health` returns `200 {"status":"ok"}`, or `503 {"status":"degraded"}` if the database is unreachable.
