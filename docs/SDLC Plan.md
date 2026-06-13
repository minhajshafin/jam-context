# Dhaka Traffic Tracker — SDLC Plan (MVP)

**Stack:** Next.js (full-stack, App Router) · Supabase (Postgres + Auth + Storage) · Mapbox GL JS
**Target duration:** ~3 weeks (part-time, evenings/weekends)
**Primary goal:** A live, demo-able web app showing Dhaka traffic incidents on a map, with report and verify flows — finished and deployable, CV-ready.

---

## Phase 0: Setup & Foundations (Day 1–2)

**Goals:**
- Working dev environment, accounts, and empty deployed skeleton

**Tasks:**
- Create Mapbox account, grab public token (no card)
- Create Supabase project, set up Postgres + Storage bucket for photos
- Scaffold Next.js app (App Router, Tailwind)
- Push to GitHub, deploy empty shell to Vercel (so deployment pipeline works from day one)

**Deliverable:** Blank deployed site showing a Mapbox map centered on Dhaka.

---

## Phase 1: Data Model & Backend (Day 3–5)

**Goals:**
- Define schema, build core API routes

**Tasks:**
- Create `incidents` table in Supabase: id, category, lat/lng, media_url, description, upvotes, downvotes, created_at, expires_at, status, is_seed
- Create `votes` table: incident_id (FK), ip_hash (SHA-256 of voter IP), direction (UP/DOWN), created_at — with a **unique constraint on `(incident_id, ip_hash)`** to enforce one vote per IP at the DB level
- API route: `POST /api/incidents` (create report — also handles Supabase Storage upload server-side; client never writes to storage directly)
- API route: `GET /api/incidents` (fetch active incidents — filter `expires_at > now()` and trust score above threshold)
- API route: `POST /api/incidents/:id/vote` (upvote/downvote)
- Set per-category TTL logic (e.g., Accident = 1.5h, Waterlogging = 4h) computed on insert

**Deliverable:** API routes testable via Postman/curl, returning/accepting correct JSON.

---

## Phase 2: Map & Pin Rendering (Day 6–8)

**Goals:**
- Visualize incidents on the map

**Tasks:**
- Integrate Mapbox GL JS into a React component
- Fetch incidents from API, render as custom SVG markers color-coded by category
- Poll every 20–30s for new incidents (no WebSockets needed)
- Click marker → open bottom sheet/modal with photo, time, description, vote buttons

**Deliverable:** Map shows live pins; clicking a pin shows incident details.

---

## Phase 3: Reporting Flow (Day 9–12)

**Goals:**
- Let users submit incidents quickly (2-tap target)

**Tasks:**
- "Report" button → request `navigator.geolocation` with a **5s timeout**; if denied or times out, show a **tap-to-place pin mode** on the map so the report flow is never blocked
- Category picker (Waterlogging, Protest, Accident, Road Damage) — big tappable icons
- Photo capture/upload → client-side resize to <200KB, then **POST to `/api/incidents`** which proxies the upload to Supabase Storage server-side (Supabase Storage key never exposed to the client)
- 150-char description field
- Submit → POST to `/api/incidents`, optimistic UI update on map

**Deliverable:** Full report flow works end-to-end on mobile browser.

---

## Phase 4: Verification & Trust Decay (Day 13–15)

**Goals:**
- Implement self-cleaning map mechanic

**Tasks:**
- Vote buttons wired to `/api/incidents/:id/vote`
- Trust score formula: `upvotes - (downvotes * 2)`, with downvote weight **capped at 10** per incident to prevent a single actor from burying a report beyond the threshold
- **IP-based dedup:** API route checks `votes` table for existing `(incident_id, ip_hash)` row before applying vote; returns 409 if already voted
- On `GET /api/incidents`, exclude pins where trust score < -4 or `expires_at` passed
- (Stretch) Proximity-based "is it still blocked?" banner using device geolocation vs incident location

**Deliverable:** Pins disappear automatically when expired or downvoted enough.

---

## Phase 5: Polish, Seed Data & Demo Prep (Day 16–18)

**Goals:**
- Make it look alive and presentable

**Tasks:**
- Seed 15–20 realistic incidents around known Dhaka hotspots (Mirpur, Gulshan, Dhanmondi, Mohakhali, Mohammadpur) with `is_seed = true`
- Style seeded pins with a subtle "Demo" badge so real users can distinguish them from live reports
- Mobile-first responsive pass (bottom sheets, button sizes)
- Loading states, error handling, empty states
- Basic landing/about section explaining the project's purpose

**Deliverable:** App looks polished and "real" to a first-time visitor.

---

## Phase 6: Deployment & Documentation (Day 19–21)

**Goals:**
- Ship it and make it CV-presentable

**Tasks:**
- Final deploy to Vercel with environment variables set
- Write README: problem statement, architecture diagram, tech stack, screenshots, live link
- Record a 60–90 sec demo video/GIF for portfolio/LinkedIn
- Add to CV/portfolio with metrics framed honestly (e.g., "built and deployed a full-stack crowdsourced mapping app")

**Deliverable:** Live URL + GitHub repo + README ready to share with recruiters.

---

## Explicit Non-Goals for v0 (revisit only if continuing post-MVP)

- WebSocket real-time sync (polling is sufficient)
- Cron-based background jobs (compute expiry on read)
- Performance/latency benchmarking
- Google Maps traffic layer integration
- User authentication (anonymous reporting is fine for MVP)

---

## Success Criteria

- [ ] App is live and publicly accessible
- [ ] A user can report an incident in under 30 seconds
- [ ] Map shows category-coded pins with working detail view
- [ ] Voting affects pin visibility correctly
- [ ] Old/expired incidents disappear automatically
- [ ] README + demo video exist for portfolio use
