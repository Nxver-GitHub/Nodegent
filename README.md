# Nodegent

Nodegent is a campus-aware AI assistant for UCSC students. It gives you a unified view of your academic life — courses, assignments, and deadlines — with an AI assistant that already knows your data, Google Calendar sync, and full visibility into everything it does on your behalf.

Built for CSE 115A Spring 2026.

---

## What Nodegent Does

| Feature | What It Means For You |
|---|---|
| **Assignment Dashboard** | All your Canvas courses and upcoming assignments in one place, sorted by due date |
| **Daily Snapshot** | A quick view of what's happening today — classes, due items, and synced events |
| **AI Assistant** | Ask questions like "What's due this week?" or "Do I have anything tomorrow?" and get answers that already know your schedule |
| **Google Calendar Sync** | Your Canvas due dates automatically pushed to Google Calendar so you never miss a deadline |
| **New Assignment Alerts** | Bell icon notifies you when Canvas posts new assignments |
| **Access Controls** | Simple on/off toggles — you decide what Nodegent can see |

---

## Getting Started

### 1. Sign In

Go to the Nodegent web app and sign in with your **Google account** (campus or personal). Nodegent uses Google sign-in via Clerk — no new password to remember.

### 2. Connect Canvas

Canvas connection requires your **CruzID and Gold Password**. Here is what happens when you connect:

1. Click **Connect Canvas** on the dashboard.
2. A live browser window opens — Nodegent uses a real browser to log in to Canvas on your behalf so it never has to store your password.
3. If you have **Duo MFA** set up, you will see the Duo prompt appear in the browser window. Approve it as you normally would.
4. Once logged in, Nodegent extracts your session cookies (not your password) and saves them to use for future syncs.
5. Your CruzID and Gold Password are **never saved** — they are held in memory only for the duration of the login, then discarded.

After connecting, Nodegent will sync your courses and assignments automatically.

### 3. Connect Google Calendar (Optional)

Click **Sync Google Calendar** to authorize Nodegent to read and write your Google Calendar. This allows:

- Your Canvas assignment due dates to appear as Google Calendar events.
- Your existing Google Calendar events to appear in your Nodegent daily snapshot.

You can revoke this access at any time from the Access Controls section of your dashboard.

### 4. Use the AI Assistant

Navigate to the **Chat** tab. The assistant already knows your courses, assignments, and schedule. Try questions like:

- "What assignments are due this week?"
- "When is my next exam?"
- "What do I have today?"

The assistant is **read-only** — it can tell you about your data but it does not submit assignments, create events, or take actions on your behalf without your explicit request.

### 5. Control What Nodegent Can Access

On the dashboard you will see the **Access Controls** card with toggles for:

- **Canvas** — turn off to pause syncing your LMS data
- **Google Calendar** — turn off to exclude calendar data from syncs and the AI assistant

Turning off a source does not delete your data. Turn it back on and everything resumes. See the [Revoking Access](#revoking-access) section to permanently remove access.

---

## Dashboard Overview

```
┌─────────────────────────────────────────────────────┐
│  Nodegent             [Notifications 🔔]  [Account] │
├─────────────────────────────────────────────────────┤
│  Daily Snapshot                                      │
│  Good morning — here's what's happening today       │
│  • 3 assignments due this week                       │
│  • 1 Google Calendar event today                     │
├─────────────────────────────────────────────────────┤
│  Assignments                    [Course Filter ▾]    │
│  ┌──────────────────────────────────────────────┐   │
│  │ ● Lab 3 — CSE 115A             Due: Today    │   │
│  │ ● Assignment 4 — CSE 101       Due: Fri      │   │
│  │ ● Reading Response — ANTH 1    Due: Next Mon │   │
│  └──────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────┤
│  Access Controls                                     │
│  Canvas          [●  ON ]                           │
│  Google Calendar [●  ON ]                           │
└─────────────────────────────────────────────────────┘
```

---

## Notifications

The bell icon (🔔) in the top right shows new assignments posted to Canvas since your last sync. Click the bell to see them. You can dismiss individual notifications or clear all at once.

Notifications are automatically suppressed if you have Canvas access turned off.

---

## Revoking Access

### Pause Access (Temporary)

Use the **Access Controls** toggles on the dashboard to pause Canvas or Google Calendar access. Your data is retained and syncing resumes when you turn it back on.

### Revoke Canvas Access (Permanent)

1. Turn off the Canvas toggle in Access Controls.
2. To fully remove your session cookies, sign out of your Nodegent account from the account menu.
3. Contact your administrator to delete stored Canvas credentials from the database.

> Note: US-4.2 (instant revocation with data deletion) adds a hard revoke button. Until that is shipped, the toggle + sign-out combination is the safest way to cut access.

### Revoke Google Calendar Access

1. Turn off the Google Calendar toggle in Access Controls.
2. For full revocation, visit [Google Account Permissions](https://myaccount.google.com/permissions) and remove Nodegent from the list of connected apps.

---

## AI Assistant Limits

The AI assistant has the following guardrails in place:

- **Read-only**: The assistant cannot submit assignments, modify Canvas data, delete calendar events, or take any write action on external systems without your explicit instruction.
- **Rate limited**: You can send up to 12 messages per minute to prevent runaway usage.
- **Context-scoped**: The assistant only uses your own data. It cannot see other students' data.
- **Toggle-aware**: If you disable Canvas or Google Calendar, that data is excluded from the assistant's context.

---

## Frequently Asked Questions

**Is my CruzID or password saved?**
No. Your CruzID and Gold Password are used only during the Canvas login process and are discarded immediately after. Only the resulting session cookies are saved, and only on Nodegent's servers — never in the browser.

**Can Nodegent submit assignments or change my grades?**
No. Nodegent reads your Canvas data but does not take any write actions on Canvas. The AI assistant is explicitly instructed to be read-only.

**Who can see my data?**
Only you. Each user's data is scoped to their own account. Nodegent's team members can access server infrastructure for maintenance, but individual student data is not accessed for any purpose other than running the service.

**What happens if I disconnect Canvas?**
Your previously synced assignments and courses remain visible in Nodegent, but no new data will be fetched. Toggle Canvas back on to resume syncing.

**Can I use my own OpenAI or Anthropic API key?**
Yes. The platform supports connecting your own OpenAI or Anthropic subscription. If no personal key is configured, the team-provisioned Groq key is used by default.

**Does Nodegent work on mobile?**
Yes. The web app is designed to be responsive and usable on a phone browser.

---

## For Developers

See [`CLAUDE.md`](CLAUDE.md) for the full technical setup guide including:

- Environment variable configuration
- Convex dev server setup
- Canvas SSO architecture
- Build and test commands

See [`SECURITY.md`](SECURITY.md) for the full security model including credential handling, data flows, and compliance details.
