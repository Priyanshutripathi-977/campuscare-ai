# CampusCare AI: step-by-step demo script (about 12 minutes)

Every step below uses features that **really work** in the app. Where something is **simulated or switched off**, the script says so, so you can explain it honestly. (See [PROJECT_GUIDE §2](PROJECT_GUIDE.md#2-what-is-real-and-what-is-simulated).)

---

## Before the demo (10 minutes, do it before people arrive)

1. **Start MongoDB** (skip if `brew services list` already shows `mongodb-community started`):
   ```bash
   brew services start mongodb/brew/mongodb-community
   ```
2. **Reset the demo data**, so the duplicate pair, the clarification ticket and the review queue are fresh:
   ```bash
   npm run seed -w server -- --reset
   ```
   Expected output: `Demo tickets created: 15 (duplicate suggestions found: 1)`.
3. **Start the app:**
   ```bash
   npm run dev
   ```
4. **Check that it's healthy.** Open http://localhost:5173. The **System status** card should show _API server: Online_ and _Database: Connected_. Or check in a terminal; it should print `"status":"ok"`:
   ```bash
   curl -s http://localhost:4000/api/health
   ```
5. **Open two browser windows**, one normal and one private/incognito. That way you can be the **student** in one and the **admin or staff** in the other without logging out.
6. **Optional backup.** If the browser misbehaves on the day, this shows the whole flow in the terminal:
   ```bash
   bash scripts/api-walkthrough.sh
   ```

**Accounts** (demo-only password for all: `Demo@1234`):

| Who                       | Email                              | Use it for                                         |
| ------------------------- | ---------------------------------- | -------------------------------------------------- |
| Aarav (student)           | `student@campuscare.test`          | Reporting and tracking                             |
| Neha (student)            | `neha@campuscare.test`             | The clarification question                         |
| Admin                     | `admin@campuscare.test`            | Dashboard, review, assigning, duplicates, settings |
| Sunita (Electrical staff) | `electrical.staff@campuscare.test` | Working on and resolving tickets                   |

---

## 1. The problem (30 s)

> "On campus, problems like a broken fan or no Wi-Fi are reported by word of mouth or WhatsApp. Reports get lost, go to the wrong people, are repeated many times, and nobody knows the status. CampusCare AI gives every complaint a ticket ID, works out what and how urgent it is, sends it to the right department, spots duplicates and tracks it until it's fixed."

**Say this up front:**

> "The AI part uses Google Gemini when an API key is configured. For this demo it's **switched off**, so you'll see the built-in **keyword classifier**. The app labels this honestly as 'Keyword fallback', and in this mode every complaint is checked by an admin. Everything else you see, including the database, routing rules, duplicate detection and notifications, is real. The tickets already in the system are **demo data**, marked with a 'Demo data' badge."

## 2. A student reports a problem (2 min), window A as Aarav

1. Go to **Report a problem** and click **Submit complaint** with the form empty.
   _Point out:_ a clear error next to each field, and the cursor jumps to the first one. The same rules are checked again on the server.
2. Fill in:
   - **Title:** `Fan making loud noise in room 305`
   - **Description:** `The ceiling fan in room 305 makes a grinding noise and wobbles. Students sitting below it are worried it may fall.`
   - **Building:** `Main Building` · **Room:** `305`
   - **Category:** leave as _Not sure — let the system decide_
3. Submit. _Point out_ the **ticket ID** and the message that an admin will review it.
4. Click **View ticket**. _Point out_ the **History**: _Submitted_ (by Aarav), then _Under Review_ (by System).

> "The complaint is **saved before any analysis runs**, so if the AI service fails, nothing is lost."

## 3. AI suggests, rules decide (3 min), window B as Admin

1. **Dashboard.** All the numbers and charts are counted from the database. Open **View data as table** under a chart: every chart has a table version for screen-reader users.
2. Click the **Needs review** tile. This is the review queue. Open _Fan making loud noise in room 305_.
3. **AI analysis** card:
   - _Keyword fallback_, 60% confident;
   - suggested _Electrical / High → Electrical Maintenance_;
   - the reasons ("Keyword match for Electrical (fan)…", "…may fall").
4. **Routing decision** card: it wasn't sent automatically because "the AI service was unavailable… not confident enough".

   > "The AI only **suggests**. Plain, tested code decides. A ticket is routed automatically only if the AI is confident, the issue isn't Critical, and a department handles that category. Otherwise a person decides, and the reasons are shown."

5. The classification is already filled in from the suggestion. Click **Save classification**. The department is suggested from the category map: pick **Sunita Rao**, then **Assign ticket**. _Point out_ the new **Target resolution** (24 h for High) and _Method: Manual (administrator)_.
6. **Show a wrong guess being corrected.** Go to **All tickets**, search `scanner`, and open _Library entry gate scanner broken_. The classifier guessed **Security** (because of the word "gate") at only 38% confidence, but the admin had set it to **IT**.

   > "This is why a human stays in the loop."

7. **Settings** (quick look): the confidence threshold (75%), "Always have a person confirm Critical complaints", categories that always need review, target times per priority, duplicate settings, and the category → department map.

## 4. Clarification: when a complaint is too vague (1 min), window A

1. Log out, then log in as **Neha**. Open _Something is broken again_.
2. A yellow box asks: _"Could you describe the problem in a bit more detail — what exactly is broken or wrong, and where?"_
3. Optional: add an update such as `It is the ceiling fan in room 12 of the girls hostel, it does not turn on at all.` and post it. The ticket is **re-analysed automatically** and the question disappears. Without Gemini it stays in admin review, which is expected.

## 5. Staff fixes it; the student is notified (2 min)

1. In window B, log out and log in as **Sunita** (Electrical staff). _Point out:_ she sees **only Electrical tickets**.
2. Open the fan ticket and click **Start work**, then **Update status**.
3. Click **Mark as resolved**, then click **Confirm & resolve** straight away. It **refuses**: it needs a resolution note _and_ the confirmation box.

   > "Resolving needs explicit confirmation."

   Type `Replaced the fan bearing and tightened the bracket`, tick the box and confirm.

4. Mention that staff can also **Send back for review** with a reason, if a ticket reached the wrong department.
5. Window A: log back in as **Aarav**. The **bell** shows unread notifications ("Your complaint was sent to Electrical Maintenance", "Work has started…", "…marked as resolved: Replaced the fan bearing…"). Each one says **✓ Email sent**.
   _Show_ http://localhost:8025 (Mailpit, see README): the same notifications arrived there as real emails.
   > "These are real emails sent over SMTP. For the demo they go to a local mail catcher, because the demo accounts don't have real mailboxes. If no mail server is configured, the bell says **In-app only**; the app never claims an email was sent when it wasn't."
6. Open the ticket. _Point out_ the full **history** with who did each step and when. Then click **Reopen this ticket** with a reason. Reopening is only possible for the student who reported it.

## 6. Duplicate detection (1.5 min), window B as Admin

1. Log in as admin again and open **Duplicates**: _Library wifi not working_ ↔ _Wi-Fi not working in library reading hall_, about 81% match. Reasons: similar description, same room, same category.

   > "This is **not AI**. It's a classic text-similarity method called TF-IDF, plus location and category. It only **suggests**; I decide."

2. Click **Confirm duplicate**, add the note `Same outage — IT is already on it`, then **Link as duplicate**.
3. Open the newer ticket. It's **linked** to the original, the student got the note, and the ticket **is still open**. Nothing was merged or deleted.

## 7. Security in 1 minute

1. As admin, open **All tickets** and note the ID of a ticket reported by **Neha** (e.g. _Sparking switchboard in Lab 3_).
2. In window A, as **Aarav**, type `http://localhost:5173/tickets/<that ID>` in the address bar. The result is **"Ticket not found"**.
   > "Other students' tickets don't just say 'forbidden'; the system doesn't even reveal they exist."
3. Mention what's tested automatically:
   - 22 endpoints × 6 kinds of user = **132 permission checks**;
   - **54** invalid-input tests;
   - photos are checked by their **real file content**, not the name;
   - passwords are **hashed**, the login cookie is **httpOnly**, and logins are **rate-limited**.

## 8. Wrap-up (30 s)

> "392 automated tests, including tests against a real temporary database and a real SMTP test server. The Gemini integration is tested with Google's real SDK against a local stand-in, but not yet with a real key; that's the first next step, followed by staff account management, automatic tests on GitHub (CI), and deploying it with HTTPS."

---

## Questions you might get (short answers)

| Question                               | Answer                                                                                                                                                                                        |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Is the AI real?"                      | The Gemini integration is real code, switched off without a key. Today you saw the keyword fallback, which the app labels as such. Duplicate detection is TF-IDF, not AI.                     |
| "What if the AI is wrong?"             | It only suggests. Critical or uncertain tickets go to a human, admins can override, and staff can send tickets back. Example: the gate-scanner ticket.                                        |
| "Show me a limitation."                | Open _Strange smell near chemistry lab_. The keyword classifier calls it Housekeeping/Medium, when a chemical smell could be dangerous. That's exactly why its results always go to an admin. |
| "Where is the data stored?"            | Local MongoDB: users, tickets (with history), departments, notifications, duplicate suggestions, settings. See PROJECT_GUIDE §6.                                                              |
| "Can a student make themselves admin?" | No. Registration always creates a student, and the role field is ignored. This is tested.                                                                                                     |

## If something goes wrong

| Symptom                                              | Quick fix                                                             |
| ---------------------------------------------------- | --------------------------------------------------------------------- |
| "Cannot reach the server"                            | The terminal running `npm run dev` stopped; start it again            |
| "Database: Unavailable"                              | `brew services start mongodb/brew/mongodb-community`                  |
| Suddenly logged out                                  | The seed reset recreates the accounts; just log in again              |
| Nothing in Duplicates / clarification ticket missing | Run `npm run seed -w server -- --reset` again                         |
| The browser misbehaves                               | Run `bash scripts/api-walkthrough.sh` and narrate the terminal output |
