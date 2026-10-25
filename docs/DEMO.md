# CampusCare AI: 10-minute demo script

## Before the demo (5 minutes)

1. Start MongoDB (skip this if it's already running):
   ```bash
   brew services start mongodb/brew/mongodb-community
   ```
2. Reset the demo data, so the duplicate pair and tickets are fresh:
   ```bash
   npm run seed -w server -- --reset
   ```
3. Start the app and open http://localhost:5173. Check that **System status** shows API Online and Database Connected:
   ```bash
   npm run dev
   ```
4. Open two browser windows (one normal, one private/incognito) so you can be a **student** and an **admin** at the same time without logging out.

All demo passwords are `Demo@1234`. The demo accounts are `student@campuscare.test`, `admin@campuscare.test` and `electrical.staff@campuscare.test`.

> Without a Gemini key the AI card shows **"Keyword fallback"**, and every new complaint goes to the admin review queue. That is expected; say so. It shows the system never pretends the AI worked.

---

## 1. The problem (30 s)

"Students report campus problems by word of mouth or WhatsApp. Complaints get lost, sent to the wrong people, reported five times, and nobody knows the status. CampusCare AI gives every complaint an ID, sends it to the right department, spots duplicates and tracks it to resolution."

## 2. Student reports a problem (2 min), in window A as `student@campuscare.test`

1. **Report a problem**, then click **Submit** with the form empty. Point out the clear field errors and that focus jumps to the first one.
2. Fill it in:
   - **Title:** Fan making loud noise in room 305
   - **Description:** The ceiling fan in room 305 makes a grinding noise and wobbles. Students below it are worried it may fall.
   - **Building:** Main Building · **Room:** 305
   - Leave the category as "Not sure".
3. Submit and show the **ticket ID**.
4. Open the ticket and show the **history** (Submitted → Under Review, by System).

_Talking point:_ "The complaint is saved before any AI runs, so an AI outage can never lose it."

## 3. AI + rules, not AI alone (2 min), in window B as `admin@campuscare.test`

1. **Dashboard**: real counts and charts from the database. Open **View data as table** on one chart (accessibility).
2. Click the **Needs review** tile to open the review queue, then open the fan ticket.
3. **AI analysis** card: the suggested category and priority, the reasons, the confidence, and the source ("Keyword fallback").
4. **Routing decision** card: _why_ it wasn't auto-routed (the listed reasons).
5. The classification is pre-filled from the suggestion. Set **priority = High**, then **Save classification**. The department is suggested from the category map. Choose **Sunita Rao**, then **Assign ticket**.

_Talking point:_ "The AI only suggests. Plain, tested rules decide. A Critical issue always needs a human, and an admin can change these rules on the Settings page."

6. Briefly show **Settings**: the confidence threshold, Critical review, the category → department map, the deadlines and the duplicate settings.

## 4. Staff resolves; student is notified (2 min)

1. In window B, log out and log in as `electrical.staff@campuscare.test`. Point out that **only Electrical tickets** are visible.
2. Open the fan ticket, click **Start work** and confirm.
3. Click **Mark as resolved** and try to confirm straight away. It refuses: a note _and_ the checkbox are required. Fill both and confirm.
4. In window A (student), the **bell** shows new notifications ("Work has started…", "marked as resolved…"), labelled **In-app only** because email isn't configured. Click one; it opens the ticket.
5. As the student, click **Reopen this ticket** and give a reason. The history shows every step, who did it and when.

## 5. Duplicates (1.5 min), as admin

1. **Duplicates** page: the demo pair "Library wifi not working" ↔ "Wi-Fi not working in library reading hall", with the match score and reasons.
2. **Confirm duplicate**, add a note, then **Link as duplicate**.
3. Open the newer ticket: it's linked to the original, the student got a note, and **the ticket is still open**.

_Talking point:_ "The system suggests and a human decides. Nothing is merged or deleted automatically."

## 6. Security in 30 seconds

- As the student, change the URL to another student's ticket ID (e.g. one listed only in the admin view). The result is **"Ticket not found"**, so you can't even tell it exists.
- Mention the automated **authorization matrix**: every endpoint tried as 6 kinds of user (136 cases), plus 54 invalid-input tests.

## 7. Wrap-up (30 s)

- 376 automated tests; the AI is optional and its failures are handled and shown honestly.
- Next steps: a real Gemini key and accuracy measurement, staff account management, deployment.

---

### If something goes wrong during the demo

| Symptom                   | Quick fix                                                          |
| ------------------------- | ------------------------------------------------------------------ |
| "Cannot reach the server" | The terminal running `npm run dev` stopped; start it again         |
| "Database: Unavailable"   | `brew services start mongodb/brew/mongodb-community`               |
| Suddenly logged out       | You ran the seed reset, which recreates the accounts; log in again |
| Nothing in Duplicates     | Run the seed reset again (it recreates the pair)                   |
