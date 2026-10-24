# CampusCare AI

An agentic campus problem-routing system: students report campus problems, AI classifies and prioritises them, the system routes them to the right department, flags possible duplicates, and tracks every ticket to resolution.

> **Project status:** Student portal, ticket tracking, admin/staff dashboard, login & roles, AI complaint understanding + automatic routing, and **duplicate suggestions** are working. Notifications are **not built yet**. See [PLAN.md](PLAN.md).

## Tech stack

| Part     | Technology                                                 |
| -------- | ---------------------------------------------------------- |
| Frontend | React 19 + TypeScript + Vite, Tailwind CSS, TanStack Query |
| Backend  | Node.js + Express 5 + TypeScript (run with `tsx`)          |
| Database | MongoDB + Mongoose                                         |
| AI       | Google Gemini (optional), with a rule-based fallback       |
| Tests    | Vitest, Supertest, React Testing Library                   |

## Folder structure

```
campus routing/
├── client/                 React app — everything the user sees (http://localhost:5173)
│   ├── src/api/            functions that call the backend
│   ├── src/components/     reusable UI pieces (ui/ = buttons, cards, spinners…)
│   └── tests/              UI tests
├── server/                 Express API — rules, security, database, AI (http://localhost:4000/api)
│   ├── src/config/         reads + validates .env settings
│   ├── src/db/             MongoDB connection
│   ├── src/middleware/     code that runs on every request (errors, later: auth, validation)
│   ├── src/utils/          small helpers
│   ├── uploads/            uploaded images (not committed to git)
│   └── tests/              API tests (use a temporary in-memory MongoDB)
├── shared/                 constants used by BOTH client and server (categories, statuses…)
├── PLAN.md                 architecture, database design, API plan, roadmap
├── .env.example            settings template (placeholders, safe to commit)
└── .env                    YOUR private settings (never committed)
```

## Prerequisites

- **Node.js 20.19+** (`node -v`)
- **npm 11** — npm 10.8 has a bug that breaks installing this project's dependencies. Upgrade once with:
  ```bash
  npm install -g npm@11
  ```
- **MongoDB 7+** running locally. On macOS with Homebrew:
  ```bash
  brew tap mongodb/brew
  brew trust mongodb/brew
  brew install mongodb-community
  brew services start mongodb/brew/mongodb-community
  ```
  (Alternatively use a free MongoDB Atlas cluster and put its connection string in `MONGODB_URI`.)

## Setup

```bash
# 1. Install all dependencies (root + client + server + shared) in one go
npm install

# 2. Create your private environment file from the template
cp .env.example .env
```

Then open `.env` and set `JWT_SECRET` to a long random string (the command to generate one is in the file). The defaults for everything else work for local development.

## Demo data (optional)

```bash
npm run seed -w server
```

Creates **clearly-flagged demo data** (shown with a "Demo data" badge in the app): 7 departments, demo accounts and 13 sample tickets. Run `npm run seed -w server -- --reset` to delete and recreate _only_ the demo data. The seed refuses to run when `NODE_ENV=production`.

| Role               | Email                              | Password    |
| ------------------ | ---------------------------------- | ----------- |
| Admin              | `admin@campuscare.test`            | `Demo@1234` |
| Student            | `student@campuscare.test`          | `Demo@1234` |
| Staff (Electrical) | `electrical.staff@campuscare.test` | `Demo@1234` |
| Staff (IT)         | `it.staff@campuscare.test`         | `Demo@1234` |

Other staff: `plumbing.staff@`, `housekeeping.staff@`, `academic.staff@`, `security.staff@` (all `@campuscare.test`). These are demo-only credentials — never reuse them for real accounts.

## Running

```bash
npm run dev
```

This starts **both** the API server and the React app. Open http://localhost:5173 — the "System status" card should show **API server: Online** and **Database: Connected**.

Stop everything with **Ctrl + C**.

### AI complaint understanding

When a student submits a complaint, the server:

1. **Saves it first** (an AI failure can never lose a complaint).
2. Asks **Gemini** to classify it (category, priority, confidence, summary, key details, location, short reasons, and whether it needs clarification). Only the complaint text and location are sent — never the student's name or email.
3. **Validates** the JSON answer with a strict schema (`shared/src/ai.ts`). Invalid answers, API errors and timeouts fall back to a built-in **keyword classifier**, and the reason is recorded.
4. Applies the **routing rules** (plain code, `server/src/services/routing.service.ts`). A ticket is routed automatically only when the AI is confident enough, the priority is not Critical, the category isn't in the "always review" list, a department is mapped to it, and the student didn't choose a different category. Otherwise it waits in the **review queue** with the reasons listed.
5. If the complaint is too vague, the student sees a **clarification question**; when they answer with an update, the ticket is analysed again automatically.

Admins change the rules, deadlines and category → department map on the **Settings** page.

**Enabling Gemini:** put your key in `.env` as `GEMINI_API_KEY=...` and restart `npm run dev`. The key is read only by the server; the browser only learns whether AI is configured. Without a key everything still works using the keyword classifier (all complaints then go to admin review).

**Measuring the AI:** `npm run ai:eval -w server` runs 20 labelled complaints (in `server/src/services/ai/evalComplaints.ts`) through the configured classifier and prints accuracy. With a key this makes ~20 Gemini API calls.

### Duplicate suggestions

New complaints are compared with recent open ones (text, location and category). Likely repeats appear on the admin **Duplicates** page with a match score and reasons. Confirming only **links** the new ticket to the original and tells the student — nothing is merged, closed or deleted. The threshold and time window are on the Settings page.

### What you can do in the app

| Role    | Pages                                                                | Actions                                                                                                                |
| ------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Student | My complaints, Report a problem, ticket page                         | Submit with optional photo, get a ticket ID, search/filter own tickets, add updates, reopen a resolved ticket          |
| Staff   | Department dashboard, Department tickets, ticket page                | See only their department's tickets, start work, resolve (with note + confirmation), add updates, send back for review |
| Admin   | Campus dashboard, All tickets (+ review queue, overdue), ticket page | Set category & priority (sets the deadline), assign/reassign department & staff, every allowed status change           |

API reference: [docs/API.md](docs/API.md).

### Troubleshooting

| Message                                                              | Fix                                                                         |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `Could not connect to MongoDB`                                       | MongoDB isn't running: `brew services start mongodb/brew/mongodb-community` |
| `Invalid environment variables`                                      | A value in `.env` is wrong — the message names it                           |
| `Port 5173 is in use` / `EADDRINUSE`                                 | Another copy is already running; stop it first                              |
| `Cannot read properties of null (reading 'edgesOut')` during install | Upgrade npm: `npm install -g npm@11`                                        |

### Health check

`GET http://localhost:4000/api/health` → `200` with `"status": "ok"` when everything works, or `503` with `"status": "degraded"` if the database connection is lost.

## Useful commands

| Command             | What it does                                      |
| ------------------- | ------------------------------------------------- |
| `npm run dev`       | Start server + client with auto-reload            |
| `npm test`          | Run all tests (server + client)                   |
| `npm run typecheck` | Check TypeScript types in every package           |
| `npm run lint`      | Find code-quality problems                        |
| `npm run format`    | Auto-format all code with Prettier                |
| `npm run build`     | Production build of the client into `client/dist` |

## How a request flows (beginner overview)

1. The browser loads the React app from Vite (`localhost:5173`).
2. React calls `fetch('/api/health')`. Vite's **proxy** forwards anything starting with `/api` to the Express server on port 4000 — so the browser thinks it's all one website.
3. Express runs the request through middleware (security headers, CORS, JSON parsing), then the matching route, and replies with JSON.
4. If anything goes wrong, the central **error handler** (`server/src/middleware/errorHandler.ts`) replies with a safe JSON error.
