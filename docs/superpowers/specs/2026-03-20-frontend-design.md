# Foresight Frontend Design Spec

**Date:** 2026-03-20
**Status:** Approved

---

## Overview

Phase 1 frontend for Foresight — a customer intelligence SaaS for small business owners. Connects to the existing FastAPI + PostgreSQL backend via REST API. Presents AI-driven churn predictions, customer data, and an AI Outreach feature in a premium, addictive UI.

---

## Visual Design System

**Style:** Dark Vibrant — near-black backgrounds, single coral parent color with derived shades, neon glow effects, particle background, cyberpunk-adjacent feel.

**Single parent color:** `#FF6040` (vivid coral — sits between orange, pink, and salmon)

| Token | Hex | Usage |
|-------|-----|-------|
| `--p0` | `#FF6040` | Base coral — primary buttons, medium risk, base accents |
| `--p1` | `#FF8060` | Lighter coral — active nav, hover states, headings |
| `--p2` | `#FFAA88` | Pale salmon — low-risk badges, high LTV scores |
| `--p3` | `#FFD0BB` | Blush — subtle stat card accent |
| `--pd1` | `#E04020` | Deep burnt orange-red — high risk, overdue, danger states |
| `--pd2` | `#B82E10` | Sienna — avatar gradients, deep accents |
| `--bg` | `#070608` | Page background |
| `--surface` | `#0e0b0a` | Cards, sidebar, table backgrounds |
| `--text` | `#f5ede8` | Primary text |
| `--muted` | `#6b5a52` | Secondary text, labels |

**Typography:**
- UI text: `Inter` (400/500/600/700/800/900)
- Code/mono labels: `JetBrains Mono`

**Effects applied globally:**
- CSS scanline overlay (subtle CRT texture via `repeating-linear-gradient`)
- Particle canvas background: 70 coral-family dots with connecting lines, mouse repulsion
- Multi-layer `box-shadow` glow on all interactive elements, breathing pulse animation at 2.5s
- Glitch animation on logo (clip-path slicing, chromatic aberration, triggers randomly every ~4s)
- Magnetic buttons: elements attract toward cursor ±25% of their bounds on hover
- Ripple effect on all button clicks
- Spring return animation (`cubic-bezier(0.34, 1.56, 0.64, 1)`) on magnetic release

---

## Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | Next.js 14 (App Router) | SSR, file-based routing, foundation for Phase 4 mobile handoff |
| Language | TypeScript | Type safety across API responses |
| Styling | Tailwind CSS | Utility-first, fast iteration |
| Animation | Framer Motion | Spring physics, layout animations |
| Data fetching | TanStack Query v5 (React Query) | Caching, background refetch, loading/error states free |
| Auth state | Zustand | Lightweight JWT store, persisted to localStorage |
| HTTP client | Axios | Shared instance with auth interceptor |
| Charts | Custom Canvas (pure) | No external lib, full control over animations |

**Backend change required:** Add `http://localhost:3000` to CORS `allow_origins` in `backend/app/main.py`.

---

## Routes (App Router)

```
/                         → redirect: /dashboard if authed, /login if not
/login                    → Login page (unauthenticated)
/register                 → Register page (unauthenticated)
/connect                  → Square integration setup — onboarding, no sidebar
/dashboard                → Main dashboard (authenticated, sidebar)
/customers/[id]           → Customer profile + AI Outreach (authenticated, sidebar)
```

`/connect` lives in an `(onboarding)` route group with a minimal layout (logo + progress only — no sidebar). It is reached after registration and before the main app. Authenticated users who have already connected can reach it from Settings.

---

## Architecture

### Auth Flow
- JWT stored in Zustand store, persisted to `localStorage`
- Axios instance in `lib/api.ts` injects `Authorization: Bearer <token>` on every request
- Next.js middleware (`middleware.ts`) checks for token and redirects unauthenticated users to `/login`
- On 401 response: clear Zustand store, redirect to `/login`

### Data Layer
- All server state managed by React Query
- Query keys: `['overview']`, `['customers']`, `['prediction', id]`
- Stale time: 5 minutes for predictions, 1 minute for dashboard overview
- Background refetch on window focus

**Endpoint → Stat Card mapping:**

| Stat Card | Endpoint | Field |
|-----------|----------|-------|
| Total Customers | `GET /dashboard/overview` | `total_customers` |
| High Churn Risk | `GET /dashboard/overview` | `high_risk_count` |
| Total Revenue | `GET /dashboard/overview` | `total_revenue` |
| Avg Visits/Customer | `GET /dashboard/overview` | `avg_visits_per_customer` |

Customer table rows: `GET /dashboard/customers` → array of `CustomerSummary`

### Auth Flow — Middleware Note
Next.js middleware runs in the Edge Runtime which has no access to `localStorage`. The JWT is therefore mirrored in an **`httpOnly` cookie** (`foresight_token`) via a Next.js API Route that acts as a token relay.

**Cookie set mechanism (required — no backend change needed):**
- Login/register form POSTs credentials to the FastAPI backend directly → receives `{ access_token }` in response body
- Frontend immediately POSTs `{ token }` to the Next.js API route `POST /api/auth/token`
- That route responds with `Set-Cookie: foresight_token=<token>; HttpOnly; SameSite=Strict; Path=/`
- Middleware reads `foresight_token` cookie to guard routes
- On logout, frontend calls `DELETE /api/auth/token` → route clears the cookie; Zustand store is also cleared client-side

### Folder Structure
```
frontend/
  app/
    page.tsx              ← root: server component, reads cookie, redirects to /dashboard or /login
    (auth)/
      login/page.tsx
      register/page.tsx
    (onboarding)/
      layout.tsx          ← minimal: logo + progress, no sidebar
      connect/page.tsx
    (app)/
      layout.tsx          ← sidebar + auth guard
      dashboard/page.tsx
      customers/[id]/page.tsx
    api/
      auth/
        token/route.ts    ← POST: set httpOnly cookie; DELETE: clear cookie
  components/
    layout/Sidebar.tsx
    dashboard/StatCard.tsx
    dashboard/LineChart.tsx
    dashboard/BarChart.tsx
    dashboard/CustomerTable.tsx
    outreach/OutreachPanel.tsx
    ui/Button.tsx
    ui/Toast.tsx
    ui/Badge.tsx
  lib/
    api.ts                ← axios instance
    store.ts              ← zustand auth store
    sound.ts              ← Web Audio API sound system
    hooks/
      useOverview.ts
      useCustomers.ts
      usePrediction.ts
  styles/
    globals.css           ← CSS variables, scanline, particle canvas base
```

---

## Pages

### `/login` and `/register`
- Full-screen dark layout, logo centered with glitch effect
- Email + password fields with coral focus glow
- Submit button: primary coral glow, magnetic, ripple
- Error states: shake animation + toast
- Success: plays ascending C-E-G tone, redirects

### `/connect`
Square integration onboarding. No sidebar — minimal layout.

**Connect flow:**
1. User clicks "Connect Square" → frontend calls `POST /square/connect` with `{ access_token: string }` (the Square OAuth token obtained from Square's OAuth redirect)
2. Backend stores token, returns `{ connected: true, merchant_name: string }`
3. UI shows success state with merchant name and a "Sync Now" button
4. "Sync Now" calls `POST /square/sync` (no body) → backend syncs customers + transactions → returns `{ synced_customers: number, synced_transactions: number }`
5. On sync success: toast + redirect to `/dashboard`

**Square OAuth redirect:** Square redirects back to `/connect?code=<auth_code>`. The frontend exchanges the code for an access token via a backend endpoint (Phase 2 — for now, user pastes their Square access token manually in a text field). This simplification must be clearly shown in the UI with helper text.

### `/dashboard`
Four stat cards (coral shades, animated counters on load):
1. Total Customers — `#FF6040`
2. High Churn Risk — `#E04020`
3. Total Revenue — `#FF8060`
4. Avg Visits/Customer — `#FFAA88`

Two charts (canvas, animate on load + tab focus via Page Visibility API):
- **Revenue Line Chart** — 6M/3M/1M tabs, smooth bezier curve draws left-to-right, pulsing live dot
- **Visit Frequency Bar Chart** — Freq/Risk/Spend tabs, bars grow from floor with stagger, value labels fade in

Customer table:
- Columns: Name, Last Visit, Spent, Visits, Churn Risk badge, Next Visit, Outreach button
- Row hover: subtle coral left border + background tint
- Risk badges: High (pd1 pulse animation), Medium (p0), Low (p2)
- "Outreach" button per row → triggers AI draft generation

AI Outreach strip (bottom of dashboard):
- Shows count of high-risk customers
- "Generate All Outreach" button → batch draft generation

### `/customers/[id]`
**Data source:** No dedicated `GET /customers/{id}` endpoint exists. Individual customer data is sourced by:
1. Reading from the React Query cache for `['customers']` (already fetched on dashboard) — find by `id`
2. If cache is empty, call `GET /dashboard/customers` and find the matching entry
3. Prediction detail comes from `GET /predictions/{customer_id}`

`CustomerSummary` fields available: `id, name, email, total_visits, total_spent, last_visit_at, churn_risk, churn_risk_score`
`PredictionResponse` fields available: `customer_id, customer_name, churn_risk, churn_risk_score, predicted_next_visit_days, predicted_ltv, top_products, insight_summary, generated_at`

**Prediction state handling:**
- If `GET /predictions/{customer_id}` returns 404 → show "No prediction yet" state with a "Generate Prediction" button that calls `POST /predictions/{customer_id}/refresh`
- If prediction exists but `generated_at` is > 7 days old → show a "Refresh" button that calls `POST /predictions/{customer_id}/refresh`; button triggers the AI-generating sound sweep; on success React Query invalidates `['prediction', id]`
- Loading state: skeleton cards (see Loading States section)

- AI prediction card: churn risk score, predicted next visit (`predicted_next_visit_days` formatted as "in X days"), lifetime value (`predicted_ltv` as currency), `top_products` as tag chips, `insight_summary` as prose
- **AI Outreach Panel:**
  - **Default mode (manual confirm):** Generate button → AI drafts message → owner reads draft → manually confirms → sends
  - **Auto mode (toggle):** AI generates + sends without manual step. Toggle is clearly labeled and off by default.
  - Message channel: Email (Phase 1), SMS (Phase 2)
  - Draft shown in a styled textarea with coral border glow

---

## Loading & Skeleton States

All pages use skeleton placeholders (dark surface with a subtle shimmer animation) while data loads. Never show a spinner — skeletons maintain layout stability.

| Component | Loading state |
|-----------|--------------|
| Stat cards | 4 skeleton cards: same size, coral shimmer bar in place of value |
| Line chart | Empty axes visible immediately; line animates in as data arrives |
| Bar chart | Bar outlines at 0 height, grow in as data arrives |
| Customer table | 5 skeleton rows with placeholder widths per column |
| Customer profile | Skeleton for name/email, skeleton prediction card |
| Prediction card (no prediction) | "No prediction yet" empty state with "Generate" button |

Shimmer: `background: linear-gradient(90deg, var(--surface) 25%, rgba(255,96,64,0.06) 50%, var(--surface) 75%)` animated `background-position` over 1.5s.

---

## Sound System (`lib/sound.ts`)

All sounds synthesized via Web Audio API (no external files). Frequencies in the 500–2kHz human ear sweet spot:

| Event | Frequency | Waveform | Duration | Notes |
|-------|-----------|----------|----------|-------|
| Button click | 880 Hz | sine | 80ms | Clean tech feel |
| Hover | 1200 Hz | sine | 40ms | Near-silent (vol 0.03) — subconscious |
| Success | C5→E5→G5 (523→659→784 Hz) | sine | 120ms each | Major chord = proven dopamine trigger |
| AI generating | 300→900 Hz sweep | sine | 400ms | Sci-fi computing |
| Sync | 400→800 Hz sweep | sine | 300ms | Data flowing in |
| Error | 220 Hz | sine | 200ms | Low frequency = alert without harshness |

Gain envelope: linear attack (8ms) → exponential decay. Avoids click artifact on stop.

**Mute toggle:** A sound on/off toggle is available in the sidebar footer (icon button). Preference stored in `localStorage`. When muted, all `playTone()` calls are no-ops. Default: on. This prevents hover sounds from becoming irritating during extended table browsing.

---

## Dopamine / Engagement Mechanics

Baked into the UI based on behavioral science research:

- **Animated counters:** Numbers count up from 0 on load and tab refocus (Zeigarnik effect — anticipation → reward)
- **Progress bars:** Fill after counters (completion drive)
- **Stat bar fill animation:** 1.8s cubic-bezier ease
- **Charts re-animate on tab focus** (Page Visibility API) — freshness signal
- **Pulsing glow on high-risk badges** — urgency without panic
- **Live dot** on last-sync timestamp — system feels alive
- **Toast spring animation** — `cubic-bezier(0.34, 1.56, 0.64, 1)` overshoot feels satisfying
- **Magnetic buttons** — physicality makes UI feel alive
- **Staggered bar chart** — each bar appears slightly after the previous (sequential reveal = more engaging than simultaneous)

---

## AI Outreach Feature

### Flow (Manual Confirm — default)
1. Owner clicks "⚡ Outreach" on a customer row or profile
2. Backend reads customer's full history, purchases, visit patterns
3. Claude generates a personalized email draft with a tailored offer
4. Draft displayed in Outreach Panel with coral textarea glow
5. Owner edits if desired → clicks "Send" → backend sends via SMTP
6. Success toast + sound

### Flow (Full Auto — owner opt-in)
1. Owner enables Auto mode via toggle (clearly labeled, off by default)
2. Batch or individual trigger sends directly
3. No manual review step
4. Confirmation toast shows what was sent

### Backend endpoints needed (new — Phase 1)

```
POST /outreach/{customer_id}/generate
  Request:  {} (no body — customer data read from DB by backend)
  Response: { draft: string, subject: string, channel: "email" }

POST /outreach/{customer_id}/send
  Request:  { draft: string, subject: string, channel: "email" }
            (draft may be the original or user-edited version)
  Response: { sent: true, recipient: string }

POST /outreach/batch
  Request:  { customer_ids: string[], auto_send: boolean }
            auto_send=false → generate drafts only, return list for review
            auto_send=true  → generate + send without review
  Response: { drafts: [{ customer_id, draft, subject }], sent_count: number }
            drafts is always populated regardless of auto_send, so the UI can
            show a confirmation of what was sent. sent_count=0 when auto_send=false.
```

---

## Phases Beyond Phase 1

| Phase | Scope |
|-------|-------|
| 2 | More integrations: Shopify, Toast, Clover, Stripe, WooCommerce |
| 3 | Weekly email digest reports |
| 4 | React Native + Expo mobile app, push notifications |
| 5 | Stripe billing — free tier + paid plans |

---

## Known Constraints

- CORS: backend currently set to `http://localhost:5173`. Must add `http://localhost:3000` for Next.js dev.
- Next.js runs on port 3000 by default. No port override needed.
- `bcrypt==4.2.1` required in backend (5.0.0 breaks passlib).
- `squareup` package used (not `square`).
- `anthropic>=0.40.0` for Python 3.14.
