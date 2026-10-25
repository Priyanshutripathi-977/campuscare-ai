# CampusCare AI — API reference

Base URL: `/api` (in development the React app proxies `/api` to `http://localhost:4000`).

- **Auth:** log in once; the server sets an `httpOnly` cookie (`cc_token`, 1 day). Send requests with cookies (`credentials: 'include'`).
- **Errors** always look like:
  ```json
  {
    "error": {
      "message": "Some fields are invalid",
      "details": { "fieldErrors": { "title": "Title must be at least 5 characters" } }
    }
  }
  ```
- **Status codes:** `400` invalid input · `401` not logged in · `403` wrong role · `404` not found _or not yours_ · `409` action not allowed in the current state · `413` body too large · `415` unsupported format · `429` rate-limited · `503` database down.
- Validation rules live in [`shared/src/schemas.ts`](../shared/src/schemas.ts) and are used by both client and server.

Roles: 🔓 public · 🎓 student · 🛠 staff · 👑 admin

## Try it: the API with `curl`

The fastest way to see the whole API working is the walkthrough script. Start the app (`npm run dev`), load demo data (`npm run seed -w server`), then run:

```bash
bash scripts/api-walkthrough.sh
```

It logs in as a student, submits a complaint, then as admin reads the AI analysis and assigns the ticket; as staff starts and resolves it; and as the student reads the history and notifications. It ends with three security checks that **must** be refused (403, 404, 401). It was last run successfully on 25 Oct 2026.

The same calls by hand. The login cookie is saved to a file with `-c` and sent back with `-b`:

```bash
# Health (no login)
curl -s http://localhost:4000/api/health

# Log in as the demo student; the cookie is saved in student.txt
curl -s -c student.txt -H 'Content-Type: application/json' \
  -d '{"email":"student@campuscare.test","password":"Demo@1234"}' \
  http://localhost:4000/api/auth/login

# Submit a complaint (multipart form; the details go in the "data" field as JSON)
curl -s -b student.txt \
  -F 'data={"title":"Fan not working in room 101","description":"The ceiling fan in room 101 stopped working yesterday.","location":{"building":"Main Building","room":"101"}}' \
  http://localhost:4000/api/tickets

# My tickets, filtered
curl -s -b student.txt 'http://localhost:4000/api/tickets?status=Under%20Review'
```

Add `-F 'image=@photo.jpg'` to attach a photo (JPG/PNG/WebP, ≤ 5 MB). Add `| jq` to any command to pretty-print the JSON.

## Health

| Method | Path      | Who | Response                                                                                                      |
| ------ | --------- | --- | ------------------------------------------------------------------------------------------------------------- |
| GET    | `/health` | 🔓  | `200 { status: "ok", database: "connected", aiConfigured, uptimeSeconds }` or `503 { status: "degraded", … }` |

## Auth

| Method | Path             | Who       | Body                                    | Notes                                                                            |
| ------ | ---------------- | --------- | --------------------------------------- | -------------------------------------------------------------------------------- |
| POST   | `/auth/register` | 🔓        | `{ name, email, password, studentId? }` | Always creates a **student**. 10/hour/IP.                                        |
| POST   | `/auth/login`    | 🔓        | `{ email, password }`                   | Same error for unknown email & wrong password. 10 failed attempts / 15 min / IP. |
| POST   | `/auth/logout`   | any       | —                                       | `204`                                                                            |
| GET    | `/auth/me`       | logged in | —                                       | `{ user: { id, name, email, role, department } }`                                |

## Tickets

| Method | Path                                | Who                            | Body / query                                                                                                                                              | Notes                                                                                                                                                        |
| ------ | ----------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| POST   | `/tickets`                          | 🎓                             | `multipart/form-data`: `data` = JSON `{ title, description, location: { building, room?, details? }, category? }`, `image` = optional JPG/PNG/WebP ≤ 5 MB | Returns `201 { ticket }` with `ticketId` like `CC-2026-000042`. New tickets start **Under Review**. 15/hour/user. Image type is verified from file contents. |
| GET    | `/tickets`                          | 🎓 own · 🛠 department · 👑 all | `?status&category&priority&department&overdue=true&needsReview=true&q&sort=newest\|oldest\|priority\|due&page&limit≤50`                                   | `{ items, total, page, pages }`                                                                                                                              |
| GET    | `/tickets/:ticketId`                | owner / dept staff / admin     | —                                                                                                                                                         | Full detail incl. history & updates. Staff see student name only; admin also sees email; students don't see internal routing info.                           |
| GET    | `/tickets/:ticketId/image`          | same as above                  | —                                                                                                                                                         | The attached photo (never public).                                                                                                                           |
| POST   | `/tickets/:ticketId/updates`        | owner / dept staff / admin     | `{ message }`                                                                                                                                             | Adds a comment.                                                                                                                                              |
| PATCH  | `/tickets/:ticketId/status`         | 🛠 (own dept) / 👑              | `{ status, note?, confirm? }`                                                                                                                             | Enforces the state machine (below). **Resolved requires `confirm: true` and a note ≥ 5 chars.**                                                              |
| POST   | `/tickets/:ticketId/reopen`         | 🎓 owner                       | `{ reason }`                                                                                                                                              | Only from Resolved.                                                                                                                                          |
| PATCH  | `/tickets/:ticketId/classification` | 👑                             | `{ category, priority }`                                                                                                                                  | Sets the deadline (`dueAt = createdAt + SLA hours`).                                                                                                         |
| PATCH  | `/tickets/:ticketId/assign`         | 👑                             | `{ departmentId, assignedTo?, note? }`                                                                                                                    | Requires classification first. Moves to **Assigned** (or keeps status when reassigning). Saves the routing decision + timestamp.                             |

### Status rules

```
Submitted → Under Review → (admin assigns) → Assigned → In Progress → Resolved → Reopened
                                   ▲             │            │                        │
                                   └─ send back ─┴────────────┘     Reopened → In Progress / Under Review
```

| From → To                                                          | Staff | Admin | Student            |
| ------------------------------------------------------------------ | ----- | ----- | ------------------ |
| Assigned → In Progress                                             | ✅    | ✅    | —                  |
| In Progress → Resolved (confirm + note)                            | ✅    | ✅    | —                  |
| Reopened → In Progress                                             | ✅    | ✅    | —                  |
| Assigned / In Progress / Reopened → Under Review (reason required) | ✅    | ✅    | —                  |
| Resolved → Reopened                                                | —     | —     | ✅ (via `/reopen`) |

## Admin / staff

| Method | Path                       | Who                          | Notes                                                                                                                                 |
| ------ | -------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/admin/stats`             | 🛠 (department) / 👑 (campus) | Live counts by status, category, priority, department; overdue; needs-review; average resolution hours; complaints per day (14 days). |
| GET    | `/admin/departments`       | 🛠 / 👑                       | Active departments with their category mapping.                                                                                       |
| GET    | `/admin/staff?department=` | 👑                           | Staff list for assignment.                                                                                                            |

## Not implemented yet (planned)

Staff account creation UI, real-time (push) notifications — the app polls every 30 s.

## Notifications (any logged-in user — only their own)

| Method | Path                                       | Notes                                                                                                                                                                                                |
| ------ | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/notifications?unread=true&page&limit≤50` | `{ items: [{ id, type, message, read, createdAt, ticket: { ticketId, title }, email: { status: 'not_configured'\|'pending'\|'sent'\|'failed', error, sentAt } }], total, page, pages, unreadCount }` |
| PATCH  | `/notifications/:id/read`                  | `404` for another user's notification.                                                                                                                                                               |
| POST   | `/notifications/read-all`                  | `{ updated }`                                                                                                                                                                                        |

Events → recipients (the actor is always excluded):

| Event                                                | Notified                                                  |
| ---------------------------------------------------- | --------------------------------------------------------- |
| Auto-routed on submission                            | Department staff (or the assigned person)                 |
| Assigned / reassigned by admin                       | Student + assigned staff member (or all department staff) |
| Status changed                                       | Student (resolution note included)                        |
| Sent back for review                                 | Admins                                                    |
| Reopened                                             | Department staff / assignee                               |
| Update posted                                        | The other side (student ↔ staff/assignee)                 |
| Clarification requested / routed after clarification | Student                                                   |
| Duplicate confirmed                                  | Student of the newer ticket                               |

`GET /admin/settings` also returns `email: { configured }` — never SMTP host/user/password.

## Duplicate detection

On every new complaint the server compares it with **older, open** complaints from the last `windowDays` days:

`score = 0.55 × text similarity (TF-IDF cosine, place words removed) + 0.25 × location (building/room) + 0.20 × same category`, × 0.7 if the buildings are clearly different.

Pairs scoring ≥ `threshold` (default 0.6) become **pending** suggestions with human-readable reasons. Each pair is suggested once (newer → older). Detection failures never block a submission.

`ticket.duplicates` on the ticket page: `{ duplicateOf: { ticketId, title? } | null, suggestions: [...] }` — `suggestions` and the original's `title` only for admins.

## Overdue

`dueAt` is stored on the ticket (`createdAt + SLA hours for its priority`). A ticket is **overdue** when `dueAt` is in the past and its status is not Resolved — computed at read time, so it can never go stale.
