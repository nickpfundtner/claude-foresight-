# Foresight — Addicting UI Redesign Spec
**Date:** 2026-04-02
**Status:** Approved

---

## Core Design Philosophy

Foresight should feel like a trusted, calm business ally — not a dashboard full of alarms. The owner's emotional experience is a first-class product requirement.

**The feeling when opening Foresight: "I've got this handled."**

- Never alarming, never clinical
- Warm, encouraging micro-copy throughout
- Smooth, satisfying animations — never jarring
- Problems are framed as opportunities, not emergencies
- The app actively lifts the owner's confidence and mood

---

## Color System

| Role | Color | Usage |
|------|-------|-------|
| Background | `#070608` | Page bg |
| Surface | `#0e0b0a` | Cards, panels |
| Primary accent | `linear-gradient(135deg, #FF6040, #FF5090)` | Buttons, highlights |
| Positive | Soft green | Good metrics, growth |
| Warning | Amber | At-risk, needs attention |
| High risk | Muted coral | Never red — calm, not alarming |
| Text | White / light gray | Body copy |

---

## Section 1 — Dashboard Page Layout & Animations

### Staggered Mount
Every element on the dashboard fades up from 8px below with opacity 0→1 on mount. Progressive delays (0ms, 80ms, 160ms, 240ms...) so the page assembles itself naturally. Implemented with Framer Motion `fadeUp` variants.

### Chart Grid Layout
```
[ Greeting + Quote                             ]
[ Gentle Nudge Strip — amber, if high risk     ]
[ Stat Card ] [ Stat Card ] [ Stat Card ] [ Stat Card ]
[ Revenue Line Chart  ] [ Churn Donut Chart    ]
[ Visit Bar Chart     ] [ Spend Bar Chart      ]
[ Customer Table — full width                  ]
```

### Gentle Nudge Strip
Appears only when 1+ customers are at high churn risk. Warm amber tone, very subtle slow glow animation. Copy is selected from a curated list of pre-written friendly strings (not live Claude generation — avoids latency on page load). Examples:
- "A few customers might be worth a check-in"
- "You may want to give these customers a look"
- "A couple of your regulars haven't visited in a while — might be worth the effort"

### Tab Focus Re-animation
All charts re-draw their animations when the browser tab regains focus (`visibilitychange` event). Already implemented in `LineChart` and `BarChart` — extended to the two new charts.

---

## Section 2 — New Chart Components

### Churn Donut Chart (`components/dashboard/DonutChart.tsx`)
- 3 colored arcs: Low (soft green), Medium (amber), High (muted coral)
- Animated arc draw-in on mount — arcs draw sequentially with ease-out
- Center: total customer count + "customers tracked" label
- Tabs: 6M / 3M / 1M — data updates with re-draw animation
- Skeleton loading state before data
- Re-animates on `visibilitychange`
- Dark glass theme: bg `#070608`, surface `#0e0b0a`

### Spend Bar Chart (`components/dashboard/SpendChart.tsx`)
- Shows average spend per visit by customer segment
- Tabs: All / New / VIP
- Bars spring up from bottom on mount, staggered left→right
- On tab switch: bars drop and re-spring with new data
- Consistent visual style with existing `BarChart`
- Skeleton loading state before data
- Re-animates on `visibilitychange`

---

## Section 3 — StatCard & CustomerTable Enhancements

### StatCard Progress Rings
- Thin circular progress ring behind each stat card icon
- Fills from 0 to current value percentage on mount
- Percentage denominators per card:
  - Total customers: % of 500 (soft target ceiling)
  - Active customers: % of total customers
  - At-risk customers: % of total customers (ring color inverts — lower fill = better)
  - Revenue: % of best month on record
- Ease-out animation, consistent with chart timing
- Color matches metric type: soft green (positive), amber (at-risk)
- Acts as a health indicator at a glance

### CustomerTable Churn Mini-Bars
- Small inline bar (battery-style) per row, next to customer name
- Shows churn risk score visually
- Low = soft green, Medium = amber, High = muted coral
- Fills in on mount with staggered delay per row — table feels alive
- High-risk rows: NOT highlighted red — muted coral bar + very subtle warm row tint
- Owner notices without feeling stressed

---

## Section 4 — Outreach Slide-Over Drawer

### Trigger
Clicking any customer row in the table opens the drawer. No page navigation — dashboard stays visible and dimmed behind.

### Drawer Contents (top to bottom)
1. Warm header — e.g. "Time to reconnect with Sarah" or "Sarah might appreciate hearing from you"
2. Customer snapshot: last visit, churn score, lifetime value, total visits
3. AI-generated outreach draft — subject line + email body with personal details highlighted
4. "Regenerate" button — fetches new draft from Claude
5. "Copy Draft" button — copies subject + body to clipboard, triggers success sound + checkmark
6. Close button + click-outside-to-dismiss

### Animations
- Drawer slides in from right with spring ease (Framer Motion)
- Background dims with fade overlay
- Drawer content fades up staggered after drawer opens
- Closes with smooth slide-out

### Tone
Clinical labels like "High Risk Customer" are replaced with warm, personal framing throughout. The drawer speaks in the same calm advisor voice as the rest of the app.

---

## Section 5 — Visual Polish & Tone System

### Button Gradient
All primary buttons: `linear-gradient(135deg, #FF6040, #FF5090)` with glow `box-shadow` on hover. Ripple + sound interactions preserved from existing implementation.

### Daily Greeting
- Displayed at top of dashboard, above stat cards
- Generated from static templates with live data interpolated (not a Claude API call — fast on every load)
- Template selected by: time of day + whether metrics are up/down/neutral vs prior week
- Examples:
  - "Good morning — your regulars are coming back strong this week."
  - "Good afternoon. A quiet day, but your top customers are still engaged."
  - "Good evening. Here's where things stand before you close up."

### Motivational Quote
- Subtle placement — below greeting or sidebar
- Rotates daily, curated for small business owners / entrepreneurs
- Unobtrusive, always present

### Milestone Celebrations
- Triggered by: churn rate drops 5%+ week-over-week, any new VIP customer, revenue up 10%+ week-over-week
- Brief celebratory moment: soft confetti burst or glowing card pulse
- Warm message: "Your loyalty is paying off — another VIP customer this month."
- Shown once per event, dismissed automatically after 4 seconds
- Never over the top — satisfying, not overwhelming

### Slow Day Support
- When key metrics are down week-over-week, greeting shifts tone
- Example: "Slow weeks are part of the journey. Here's what's still working in your favor."
- No alarms, no red — honest and encouraging

---

## Section 6 — Theme Customization

### Theme Picker
Located in Settings → Appearance. Displayed as a simple grid of visual swatches — one tap to apply. App re-skins instantly. No color wheels, no hex codes, no complex panels.

### 14 Built-In Themes

| # | Name | Background | Accent |
|---|------|-----------|--------|
| 1 | **Dark Vibrant** (default) | `#070608` dark | Salmon → pink gradient |
| 2 | **Midnight Blue** | Deep navy | Electric blue |
| 3 | **Forest** | Dark green | Warm gold |
| 4 | **Light Mode** | White / light gray | Salmon |
| 5 | **Sunset** | Deep burgundy | Orange / amber gradient |
| 6 | **Arctic** | Icy white / silver | Cool cyan |
| 7 | **Obsidian** | Pure black | Purple / violet |
| 8 | **Rose Gold** | Soft dark | Rose gold + blush |
| 9 | **Neon Noir** | Near-black | Neon green |
| 10 | **Sand** | Warm beige / tan | Terracotta |
| 11 | **Ocean** | Dark teal | Seafoam |
| 12 | **Lavender** | Soft purple-gray | Lilac |
| 13 | **Crimson** | Dark charcoal | Deep red |
| 14 | **Monochrome** | Black / white / gray | None |

### Implementation
- Theme stored in `localStorage` + user settings in DB
- CSS custom properties (`--bg`, `--surface`, `--accent`, etc.) swapped at root level
- All components reference variables — no hardcoded colors outside the theme system
- Default theme applied server-side to avoid flash on load

---

## Tech Stack
- **Framework:** Next.js (App Router)
- **Styling:** Tailwind CSS
- **Animations:** Framer Motion
- **Sound:** `lib/sound.ts` (already built)
- **Charts:** Custom components (existing pattern — no chart library)
- **State:** React hooks + existing API wiring

---

## Out of Scope (future specs)
- n8n self-healing automation agents
- Micro-learning lessons
- Competitor intelligence
- Personalized deals / loyalty tools
- Goal tracking
- Mobile app
- Billing
