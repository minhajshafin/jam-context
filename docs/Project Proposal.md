## Project Proposal: Dhaka Traffic Context Tracker

## 1. Executive Summary

Google Maps shows *where* Dhaka traffic is bad, but not *why*. This project is a lightweight, crowdsourced web app that overlays community-reported context — incident type, photo, and timestamp — onto an interactive map of Dhaka, so commuters can make informed re-routing decisions in real time.

## 2. Problem Statement

- **The Clarity Gap:** A traffic jam could mean a minor breakdown or hours of impassable waterlogging — commuters can't tell the difference.
- **The Safety Gap:** Unannounced protests or road excavations create hazards with no early warning.
- **Fragmented Reporting:** Traffic updates exist on social media but are scattered, unsearchable, and not location-indexed.

## 3. Core Workflow

```
Commuter reports incident (GPS + category + photo)
        │
        ▼
Pin appears on map for nearby users
        │
        ▼
Other users vote "Still blocked" / "Cleared"
        │
        ▼
Pin auto-expires or is removed if downvoted
```

## 4. MVP Scope

### Module 1: Interactive Map
- Mapbox GL JS map centered on Dhaka
- Color-coded markers by incident category (Waterlogging, Protest, Accident, Road Damage)
- Tap marker → bottom sheet with photo, time, description, and vote buttons

### Module 2: Reporting Flow
- GPS capture via `navigator.geolocation`; if denied or slow (>5s timeout), falls back to a **tap-to-place pin** on the map so the report flow is never blocked
- Category selection (4 icons)
- Photo upload is **proxied through the Next.js API route** (`POST /api/incidents`) — the client never talks to Supabase Storage directly, preventing unauthorized bucket writes
- Client-side image resize to <200KB before sending to the API
- 150-character description limit

### Module 3: Trust & Lifecycle
- Category-based expiry (e.g., Accident: 1.5h, Waterlogging: 4h), computed at creation
- Trust score: `upvotes − (downvotes × 2)`
- Pins hidden automatically once expired or trust score drops below −4
- **Vote abuse prevention:** one vote per incident per IP address, enforced server-side via a `votes` table (incident_id + ip_hash). Prevents coordinated downvote spam without requiring user accounts.
- **Vote cap:** total downvote weight capped at 10 per incident so a single bad actor flooding votes cannot permanently suppress a legitimate report beyond the −4 threshold
- All lifecycle logic computed on read — no background jobs required

## 5. Technical Stack

| Layer | Choice |
|---|---|
| Frontend & Backend | Next.js (App Router, API routes) |
| Database & Storage | Supabase (Postgres + Storage) |
| Map | Mapbox GL JS (free tier — 50k map loads/month, sufficient for a portfolio project) |
| Hosting | Vercel |

### Data Schema (`incidents` table)

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `category` | enum | WATERLOGGING, PROTEST, ACCIDENT, CONSTRUCTION |
| `lat`, `lng` | float | Location |
| `media_url` | string | Compressed photo URL |
| `description` | string(150) | Short note |
| `upvotes` / `downvotes` | int | Validation counts |
| `created_at` / `expires_at` | timestamp | Lifecycle |
| `status` | enum | ACTIVE, ARCHIVED |
| `is_seed` | boolean | Flags seeded demo data so UI can style it differently |

### Data Schema (`votes` table)

| Field | Type | Notes |
|---|---|---|
| `incident_id` | UUID | FK → incidents |
| `ip_hash` | string | SHA-256 of voter IP (not stored raw) |
| `direction` | enum | UP, DOWN |
| `created_at` | timestamp | For audit / future decay |

> **Unique constraint on `(incident_id, ip_hash)`** enforces one vote per user per incident at the database level.

## 6. Cold-Start Strategy

A crowdsourced map is empty — and useless — without users. To avoid this on first launch and during demos, the map is seeded with 15–20 realistic incidents at known congestion points (Mirpur, Gulshan, Dhanmondi, Mohakhali, Mohammadpur), clearly distinguishable from live user reports.

## 7. Out of Scope (v0)

- Real-time sync via WebSockets — periodic polling (~20–30s) is sufficient
- Background cron jobs for cleanup — handled at query time
- Google Maps traffic layer — requires billing setup; not core to the value proposition
- User accounts/authentication — anonymous reporting for MVP

## 8. Outcome

A live, deployed, fully working application demonstrating end-to-end full-stack development: geolocation, media handling, real-time-feeling data sync, spatial data modeling, and a self-moderating community system — suitable as a portfolio centerpiece and CV talking point.
