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
- **Status codes:** `400` invalid input · `401` not logged in · `403` wrong role · `404` not found _or not yours_ · `409` action not allowed in the current state · `429` rate-limited · `503` database down.
- Validation rules live in [`shared/src/schemas.ts`](../shared/src/schemas.ts) and are used by both client and server.

Roles: 🔓 public · 🎓 student · 🛠 staff · 👑 admin

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

| From → To                                        | Staff | Admin | Student            |
| ------------------------------------------------ | ----- | ----- | ------------------ |
| Assigned → In Progress                           | ✅    | ✅    | —                  |
| In Progress → Resolved (confirm + note)          | ✅    | ✅    | —                  |
| Reopened → In Progress                           | ✅    | ✅    | —                  |
| Assigned / In Progress / Reopened → Under Review | —     | ✅    | —                  |
| Resolved → Reopened                              | —     | —     | ✅ (via `/reopen`) |

## Admin / staff

| Method | Path                       | Who                          | Notes                                                                                                                                 |
| ------ | -------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/admin/stats`             | 🛠 (department) / 👑 (campus) | Live counts by status, category, priority, department; overdue; needs-review; average resolution hours; complaints per day (14 days). |
| GET    | `/admin/departments`       | 🛠 / 👑                       | Active departments with their category mapping.                                                                                       |
| GET    | `/admin/staff?department=` | 👑                           | Staff list for assignment.                                                                                                            |

## Not implemented yet (planned)

Duplicate suggestions, notifications, staff account creation UI.
