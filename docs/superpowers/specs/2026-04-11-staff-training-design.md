# Staff Training Module — Design Spec

**Date:** 2026-04-11
**Feature:** Staff Training Module integrated into Foresight
**Status:** Approved, ready for implementation

---

## Overview

A lightweight AI-powered training module built into Foresight. Business owners can create role-specific training tracks for new workers. Workers get their own login and a simple, encouraging training portal. The goal is to help new hires get up to speed — not to run a formal certification program.

---

## Section 1 — Roles & Auth

### Two user types

| Type | Table | Access |
|---|---|---|
| Owner | `users` (existing) | Dashboard, predictions, outreach, staff management |
| Worker | `workers` (new) | Training portal only |

### Login flow

Single `/login` page with a toggle at the top: **"I'm an Owner"** / **"I'm a Worker"**. Both use email + password. The backend issues a JWT with a `role` claim (`owner` or `worker`).

After login:
- Owner → `/dashboard`
- Worker → `/training`

### Route guards

- Workers cannot access `/dashboard`, `/predictions`, `/outreach`, `/staff`, or any business data endpoints.
- Owners cannot access `/training` worker routes.

### Worker accounts

Workers are stored in a separate `workers` table. Each worker belongs to a business via `business_id` (FK to `users.id`). Fields: `id`, `business_id`, `name`, `email`, `hashed_password`, `role_name`, `created_at`.

Owners create worker accounts from the Staff page — no self-registration for workers.

---

## Section 2 — Data Models

### `training_tracks`

A track maps to a role (e.g., "Server", "Stylist", "Receptionist"). Each business can have multiple tracks.

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| business_id | UUID | FK to users.id |
| title | string | e.g., "Server Training" |
| role_name | string | e.g., "Server" |
| description | string | Optional short description |
| created_at | timestamp | |

### `training_modules`

The content inside a track. Each module has a type that determines its content structure.

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| track_id | UUID | FK to training_tracks.id |
| type | enum | `quiz`, `guide`, `scenario`, `video` |
| title | string | |
| content | JSON | Shape varies by type (see below) |
| order | int | Display order within track |
| created_at | timestamp | |

**Content JSON shapes by type:**
- `quiz`: `{ questions: [{ question, options: string[], correct_index }] }`
- `guide`: `{ text: string }` (markdown)
- `scenario`: `{ situation: string, options: string[], best_index: int, explanation: string }`
- `video`: `{ url: string, caption: string }`

### `worker_track_assignments`

Links a worker to their assigned track.

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| worker_id | UUID | FK to workers.id |
| track_id | UUID | FK to training_tracks.id |
| assigned_at | timestamp | |

### `worker_progress`

Tracks module completion per worker.

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| worker_id | UUID | FK to workers.id |
| module_id | UUID | FK to training_modules.id |
| score | int | null for non-quiz types; 0–100 for quizzes (percentage of correct answers, rounded) |
| completed_at | timestamp | |

---

## Section 3 — AI Content Generation

When creating a track, the owner can click **"Generate Starter Kit"**. Foresight uses their business type (pre-filled from their profile) and the role name to prompt Claude.

### What Claude generates

- 3–5 quiz questions (multiple choice, one correct answer each)
- 1 short guide (key things to know on day one — plain language, no jargon)
- 1 mock scenario (a realistic situation + 3 options + best response + brief explanation)

### After generation

The owner sees the generated modules in the track editor. They can:
- Edit any module inline
- Delete modules they don't want
- Add their own modules (quiz, guide, scenario, or video link)
- Reorder modules (up/down arrows)

### AI prompt structure

```
Business type: {business_type}
Role: {role_name}

Generate a lightweight training starter kit for a new {role_name} at a {business_type}.
Include:
- 3 to 5 multiple choice quiz questions about common situations or knowledge for this role
- A short day-one guide (key things to know, plain language, under 200 words)
- One realistic scenario with 3 response options and a brief explanation of the best one

Keep the tone friendly and encouraging. This is meant to help someone get comfortable quickly, not pass an exam.
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
| POST | /staff/tracks/{id}/modules | Add a module to a track |
| PUT | /staff/modules/{id} | Edit a module |
| DELETE | /staff/modules/{id} | Delete a module |
| POST | /staff/tracks/{id}/generate | AI-generate starter kit for a track |
| POST | /staff/workers/{id}/assign | Assign a worker to a track |
| GET | /staff/workers/{id}/progress | View a worker's progress |

### Worker-facing (`/training/...`, requires `worker` role)

| Method | Route | Description |
|---|---|---|
| GET | /training/my-track | Get assigned track + modules |
| GET | /training/my-progress | Get own progress across all modules |
| POST | /training/modules/{id}/complete | Mark module complete + submit score |

### Auth (`/auth/...`, existing, extended)

- Existing `/auth/login` extended: accepts an optional `role` field (`owner` or `worker`, defaults to `owner`). Routes to the correct table based on role. Returns JWT with `role` claim.

---

## Section 5 — Owner UI

### Sidebar addition

New **"Staff"** item in the existing sidebar, below Dashboard.

### `/staff/workers`

- List of workers: name, role name, assigned track, progress bar (% of modules complete)
- "Add Worker" button → modal: name, email, role name, temporary password → creates account. Owner shares the temporary password with the worker directly (no email invite in v1).
- Click a worker row → side drawer showing their module-by-module progress and scores

### `/staff/tracks`

- List of tracks: title, role name, module count, worker count
- "New Track" button → form: title + role name → then lands in track editor
- Track editor:
  - Module list with up/down reorder and delete
  - "Generate Starter Kit" button (only shown when track has 0 modules)
  - "Add Module" button → pick type → inline form for content
  - Inline editing of module title and content

### Styling

Matches existing Foresight dark theme — `#070608` background, `#FF6040` salmon accent, same card and typography patterns as Dashboard. No new design system needed.

---

## Section 6 — Worker UI

### `/training` — Training portal

Completely separate from the owner dashboard. No sidebar, no business data.

**Layout:**
- Top: welcome message — "Welcome, {name} — {role_name}"
- Progress bar: "3 of 6 complete — you're halfway there"
- Module checklist below: ordered list, completed modules marked with a checkmark, current module highlighted

**Module viewer (full screen, one at a time):**

- **Quiz:** One question at a time, multiple choice. On answer, show if correct with a brief note. No final grade shown — just move to next question.
- **Guide:** Clean readable text (rendered markdown). "Mark as Read" button at the bottom.
- **Scenario:** Show situation, then 3 options. On selection, reveal the explanation.
- **Video:** Embedded player + caption. "Mark as Watched" button.

**Tone:** Friendly and encouraging throughout. No failure states — wrong quiz answers just move forward. No leaderboard, no pressure.

**Styling:** Same dark theme as Foresight, but stripped down — no sidebar, no navigation clutter. Just their name, their track, their modules.

---

## Section 7 — Migrations

Two new Alembic migrations:

1. `007_add_workers_table` — creates `workers` table
2. `008_add_training_tables` — creates `training_tracks`, `training_modules`, `worker_track_assignments`, `worker_progress`

---

## Out of Scope (for this version)

- Worker self-registration (owner always creates worker accounts)
- Worker-to-worker messaging
- Certificate / completion badges
- Email notifications to workers
- Multiple track assignments per worker
- Analytics beyond per-worker progress
