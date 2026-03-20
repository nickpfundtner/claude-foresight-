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
/login                    → Login page
/register                 → Register page
/connect                  → Square integration setup (post-register)
/dashboard                → Main dashboard
/customers/[id]           → Customer profile + AI Outreach
```

---

## Architecture

### Auth Flow
- JWT stored in Zustand store, persisted to `localStorage`
- Axios instance in `lib/api.ts` injects `Authorization: Bearer <token>` on every request
- Next.js middleware (`middleware.ts`) checks for token and redirects unauthenticated users to `/login`
- On 401 response: clear Zustand store, redirect to `/login`

### Data Layer
- All server state managed by React Query
- Query keys: `['overview']`, `['customers']`, `['customer', id]`, `['prediction', id]`
- Stale time: 5 minutes for predictions, 1 minute for dashboard overview
- Background refetch on window focus

### Folder Structure
```
frontend/
  app/
    (auth)/
      login/page.tsx
      register/page.tsx
    (app)/
      layout.tsx          ← sidebar + auth guard
      dashboard/page.tsx
      connect/page.tsx
      customers/[id]/page.tsx
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
- Square OAuth connect flow
- Shows connected integrations with glow status indicators
- "Sync Now" button triggers manual sync, progress toast

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
- Full customer profile: visit history, spend breakdown, top products
- AI prediction card: churn risk score, predicted next visit, lifetime value, insight summary
- **AI Outreach Panel:**
  - **Default mode (manual confirm):** Generate button → AI drafts message → owner reads draft → manually confirms → sends
  - **Auto mode (toggle):** AI generates + sends without manual step. Toggle is clearly labeled and off by default.
  - Message channel: Email (Phase 1), SMS (Phase 2)
  - Draft shown in a styled textarea with coral border glow

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

### Backend endpoint needed (new)
```
POST /outreach/{customer_id}/generate   → returns { draft: string, channel: 'email'|'sms' }
POST /outreach/{customer_id}/send       → sends the (optionally edited) draft
POST /outreach/batch                    → generates + optionally auto-sends for N customers
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
