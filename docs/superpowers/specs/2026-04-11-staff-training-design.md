# Staff Training Module — Design Spec

**Date:** 2026-04-11
**Feature:** Staff Training Module integrated into Foresight
**Status:** Approved, ready for implementation

---

## Product Vision

Starting a new job is stressful. Most small businesses don't have formal training — new hires learn by watching, asking questions, and making mistakes on the floor. This feature changes that.

The Staff Training Module lets business owners build lightweight, AI-powered training tracks for their team. Workers log in, work through their track at their own pace, and arrive on the floor more confident. Owners get visibility into progress without having to babysit anyone.

The key principle: this is a tool to help people get comfortable, not a test to pass. No grades shown to workers, no failure states, no pressure. Just a clear path from day one to feeling ready.

---

## User Flows

### Owner flow
1. Adds "Staff" to sidebar → lands on `/staff/workers`
2. Creates a new training track → picks a role name
3. Clicks "Generate Starter Kit" or picks an industry template → gets pre-built modules instantly
4. Edits/removes/reorders modules to match their business
5. Adds a worker → sets their name, email, role, and temporary password
6. Assigns the worker to a track
7. Monitors worker progress from the workers list — sees completion % and any flagged modules

### Worker flow
1. Opens Foresight → selects "I'm a Worker" → logs in
2. Lands on `/training` — sees their track, welcome message, progress bar
3. Works through modules one at a time — quizzes, guides, scenarios, videos
4. Flags anything confusing with "I didn't get this"
5. Completes the last module → sees a "You're ready!" celebration screen
6. Can revisit any completed module anytime

---

## Section 1 — Roles & Auth

### Two user types

| Type | Table | Access |
|---|---|---|
| Owner | `users` (existing) | Dashboard, predictions, outreach, staff management |
| Worker | `workers` (new) | Training portal only |

### Login page

Single `/login` page for everyone. A toggle at the top lets users pick: **"I'm an Owner"** or **"I'm a Worker"**. Both use email + password. The backend returns a JWT with a `role` claim (`owner` or `worker`).

After login:
- Owner → `/dashboard`
- Worker → `/training`

The toggle defaults to "I'm an Owner" so existing users hit no friction.

### Route guards

Workers cannot access `/dashboard`, `/predictions`, `/outreach`, `/staff`, or any business data endpoints. Owners cannot access `/training` worker routes. Both are enforced at the backend via JWT role claim.

### Worker accounts

Workers are stored in a separate `workers` table — they have a completely different profile from owners (no business settings, no Square connection, no billing). Each worker belongs to a business via `business_id` (FK to `users.id`).

Fields: `id`, `business_id`, `name`, `email`, `hashed_password`, `role_name`, `created_at`.

Owners create all worker accounts — no self-registration. When creating an account, the owner sets a temporary password and shares it with the worker directly (no email invite in v1).

### Auth route change

Existing `/auth/login` extended to accept an optional `role` field (`owner` or `worker`, defaults to `owner`). Routes to the correct table based on role and returns a JWT with the appropriate `role` claim.

---

## Section 2 — Data Models

### `training_tracks`

A track maps to a role (e.g., "Server", "Stylist", "Receptionist"). Each business can have multiple tracks — one per role.

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| business_id | UUID | FK to users.id |
| title | string | e.g., "Server Training" |
| role_name | string | e.g., "Server" |
| description | string | Optional short description |
| created_at | timestamp | |

### `training_modules`

The content inside a track. Each module has a `type` that determines its content shape.

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| track_id | UUID | FK to training_tracks.id |
| type | enum | `quiz`, `guide`, `scenario`, `video` |
| title | string | |
| content | JSON | Shape varies by type (see below) |
| order | int | Display order within track |
| created_at | timestamp | |

**Content JSON shapes:**
- `quiz`: `{ questions: [{ question: string, options: string[], correct_index: int }] }`
- `guide`: `{ text: string }` (markdown)
- `scenario`: `{ situation: string, options: string[], best_index: int, explanation: string }`
- `video`: `{ url: string, caption: string }`

### `worker_track_assignments`

Links a worker to their assigned track. One track per worker in v1.

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| worker_id | UUID | FK to workers.id |
| track_id | UUID | FK to training_tracks.id |
| assigned_at | timestamp | |

### `worker_progress`

Tracks per-module completion for each worker.

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| worker_id | UUID | FK to workers.id |
| module_id | UUID | FK to training_modules.id |
| score | int | null for non-quiz types; 0–100 for quizzes (% correct, rounded) |
| completed_at | timestamp | |

### `module_flags`

Stores "I didn't get this" flags raised by workers.

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| worker_id | UUID | FK to workers.id |
| module_id | UUID | FK to training_modules.id |
| flagged_at | timestamp | |

---

## Section 3 — AI Content Generation

### Generate Starter Kit

When an owner creates a new track, they can click **"Generate Starter Kit"**. Foresight uses the business type (pre-filled from their profile) and the role name to prompt Claude, which returns:

- 3–5 quiz questions (multiple choice, one correct answer each)
- 1 short day-one guide (plain language, under 200 words, no jargon)
- 1 mock scenario (realistic situation + 3 options + best response + brief explanation)

The generated modules appear immediately in the track editor. The owner can edit, delete, reorder, or add more — the AI output is a head start, not a final product.

### Industry Templates

For common roles, owners can skip generation entirely and pick a **pre-built template** instead. Templates are curated by Foresight for the most common business types and roles.

Initial templates:
- Restaurant: Server, Host, Busser, Bartender
- Salon: Stylist, Receptionist, Assistant
- Retail: Sales Associate, Cashier, Stockroom

Picking a template loads a pre-built set of modules instantly. The owner can customize from there. Templates are maintained in the Foresight codebase as JSON seed data — no external dependency.

### AI Prompt Structure

```
Business type: {business_type}
Role: {role_name}

Generate a lightweight training starter kit for a new {role_name} at a {business_type}.

Return a JSON object with this structure:
{
  "quiz": {
    "title": "Quick Knowledge Check",
    "questions": [
      { "question": "...", "options": ["...", "...", "..."], "correct_index": 0 }
    ]
  },
  "guide": {
    "title": "Day One: What You Need to Know",
    "text": "..."
  },
  "scenario": {
    "title": "Real Situation Practice",
    "situation": "...",
    "options": ["...", "...", "..."],
    "best_index": 0,
    "explanation": "..."
  }
}

Rules:
- 3 to 5 quiz questions
- Guide under 200 words, plain language
- Scenario with exactly 3 options
- Tone: friendly and encouraging — this helps someone get comfortable, not pass an exam
```

---

## Section 4 — Backend Routes

### Owner-facing (`/staff/...`, requires `owner` role)

| Method | Route | Description |
|---|---|---|
| POST | /staff/workers | Create a worker account |
| GET | /staff/workers | List all workers for the business |
| POST | /staff/tracks | Create a training track |
| GET | /staff/tracks | List all tracks for the business |
| GET | /staff/templates | List available industry templates |
| POST | /staff/tracks/{id}/load-template | Load a template into a track |
| POST | /staff/tracks/{id}/modules | Add a module to a track |
| PUT | /staff/modules/{id} | Edit a module |
| DELETE | /staff/modules/{id} | Delete a module |
| PATCH | /staff/modules/{id}/reorder | Update module order |
| POST | /staff/tracks/{id}/generate | AI-generate starter kit for a track |
| POST | /staff/workers/{id}/assign | Assign a worker to a track |
| GET | /staff/workers/{id}/progress | View a worker's progress + flags |

### Worker-facing (`/training/...`, requires `worker` role)

| Method | Route | Description |
|---|---|---|
| GET | /training/my-track | Get assigned track + all modules |
| GET | /training/my-progress | Get own completion status per module |
| POST | /training/modules/{id}/complete | Mark module complete, submit quiz score |
| POST | /training/modules/{id}/flag | Flag a module as confusing |

### Auth

- POST `/auth/login` — extended to accept optional `role` field (`owner` \| `worker`)

---

## Section 5 — Owner UI

### Sidebar

New **"Staff"** item added to the existing sidebar, below Dashboard.

### `/staff/workers`

- Worker list: name, role name, assigned track, progress bar (% complete), flag indicator (red dot if any modules flagged)
- "Add Worker" button → modal: name, email, role name, temporary password → creates account and optionally assigns to a track immediately
- Click a worker row → drawer showing module-by-module progress, scores, and any flagged modules with timestamps

### `/staff/tracks`

- Track list: title, role name, module count, worker count assigned
- "New Track" button → modal: title + role name → opens track editor
- Track editor:
  - Two options at the top when the track is empty: "Generate with AI" and "Use a Template"
  - Module list with up/down reorder arrows and delete button
  - "Add Module" button → pick type (quiz / guide / scenario / video) → inline form
  - Click any module to edit it inline
  - Flag count shown on each module (e.g., "2 workers flagged this")

### Styling

Matches the existing dark theme — `#070608` background, `#FF6040` salmon accent, same card and typography patterns as Dashboard. No new design language needed.

---

## Section 6 — Worker UI

### `/training` — Training portal

Stripped-down layout — no sidebar, no business data, nothing that isn't about their training.

**Landing view:**
- Welcome message: "Welcome, {name} — {role_name} at {business_name}"
- Progress bar: "3 of 6 complete — you're halfway there"
- Module checklist: ordered list, completed modules have a checkmark, current module is highlighted

**Module viewer (full screen, one module at a time):**

- **Quiz:** One question at a time, multiple choice. After answering, brief feedback is shown (right/wrong + a short note). No final score displayed — just move forward.
- **Guide:** Clean readable text (rendered markdown). "Mark as Read" button at the bottom.
- **Scenario:** Situation is shown, then 3 options. After picking, the explanation is revealed.
- **Video:** Embedded player + caption. "Mark as Watched" button below.

**"I didn't get this" button** — present on every module, below the content. Tapping it records a flag and shows a brief "Got it — your manager will take a look" confirmation. No friction, no required explanation.

**Completion screen** — after the last module is marked complete, a full-screen "You're ready!" moment: short congratulations message, their name, their role. A clear, positive endpoint to the experience.

**Tone throughout:** Encouraging, not clinical. Progress is framed as momentum ("you're halfway there"), not a score. Wrong answers don't trigger failure states — just move to the next thing.

**Styling:** Same dark theme as Foresight — `#070608`, `#FF6040` accent — but layout is minimal. No clutter, no navigation beyond going back to the module list.

---

## Section 7 — Migrations

Three new Alembic migrations (continuing from the existing 006):

1. `007_add_workers_table` — creates `workers`
2. `008_add_training_tables` — creates `training_tracks`, `training_modules`, `worker_track_assignments`, `worker_progress`
3. `009_add_module_flags_table` — creates `module_flags`

---

## Out of Scope (v1)

- Worker self-registration
- Email invites or notifications
- Multiple track assignments per worker
- Certificate or badge on completion
- Worker-to-worker or worker-to-owner messaging
- Leaderboards or comparative analytics
- Custom template creation (templates are Foresight-managed seed data)
