# Dhaka Traffic Context Tracker — Detailed Implementation Plan

## Overview

A full-stack crowdsourced mapping web app where commuters in Dhaka report traffic incidents (waterlogging, protests, accidents, road damage) on a live Mapbox map, vote on their status, and watch pins expire automatically.

**Stack:** Next.js 14 (App Router) · Supabase (Postgres + Storage) · Mapbox GL JS · Tailwind CSS · Vercel  
**Timeline:** ~3 weeks part-time

---

## Project File Structure

```
jam-context/
├── app/
│   ├── layout.tsx              # Root layout, fonts, global meta
│   ├── page.tsx                # Home page — renders the map shell
│   ├── api/
│   │   ├── incidents/
│   │   │   ├── route.ts        # GET (list) + POST (create)
│   │   │   └── [id]/
│   │   │       └── vote/
│   │   │           └── route.ts  # POST (upvote/downvote)
│   └── globals.css
├── components/
│   ├── Map.tsx                 # Mapbox GL JS wrapper (client component)
│   ├── IncidentMarker.tsx      # SVG marker per category
│   ├── IncidentSheet.tsx       # Bottom sheet — detail + vote buttons
│   ├── ReportDrawer.tsx        # Slide-up reporting flow
│   ├── CategoryPicker.tsx      # 4-icon category selector
│   ├── PhotoUploader.tsx       # File input + client-side resize
│   └── TapToPlaceOverlay.tsx   # Fallback geo: tap-on-map to set coords
├── lib/
│   ├── supabase.ts             # Supabase client (server-side only)
│   ├── constants.ts            # TTL map, trust threshold, categories
│   ├── trustScore.ts           # Pure fn: score(upvotes, downvotes)
│   ├── ipHash.ts               # SHA-256 of request IP
│   └── imageResize.ts          # Client-side canvas resize to <200KB
├── types/
│   └── index.ts                # Incident, Vote, Category types
├── scripts/
│   └── seed.ts                 # Run once to seed 15–20 demo incidents
├── public/
│   └── icons/                  # SVG icons for categories
├── .env.local                  # Local secrets (never committed)
└── docs/                       # Proposal + SDLC (already exists)
```

---

## Phase 0 — Setup & Foundations (Day 1–2)

### Step 0.1 — External Accounts

1. **Mapbox:** Create account at mapbox.com → copy the default public token. No credit card needed for the free tier (50k map loads/month).
2. **Supabase:** Create a new project → note the **Project URL** and **`anon` key** (used client-side for reads) and the **`service_role` key** (used server-side only, never exposed to the browser).
3. **GitHub:** Create a new repo `jam-context`, push the project there.
4. **Vercel:** Import the GitHub repo, deploy immediately (even before any code — confirms the pipeline works).

### Step 0.2 — Scaffold Next.js

```bash
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir=false \
  --import-alias="@/*"
```

Install additional packages:

```bash
npm install mapbox-gl @supabase/supabase-js browser-image-compression
npm install -D @types/mapbox-gl
```

> Tailwind CSS is included by default in the `create-next-app` scaffold above.

### Step 0.3 — Environment Variables

Create `.env.local`:

```env
# Mapbox
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1...

# Supabase — public (safe for browser)
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...

# Supabase — secret (API routes only, never sent to browser)
SUPABASE_SERVICE_ROLE_KEY=eyJh...
```

Add the same variables to Vercel → Settings → Environment Variables.

### Step 0.4 — Blank Map Deliverable

Create `components/Map.tsx` as a `'use client'` component that:
- Mounts a Mapbox map centered on Dhaka (`[90.4125, 23.8103]`, zoom 12)
- Uses the `NEXT_PUBLIC_MAPBOX_TOKEN`

Render it in `app/page.tsx`. Deploy → verify the map loads on the live Vercel URL.

---

## Phase 1 — Data Model & Backend (Day 3–5)

### Step 1.1 — Supabase Schema

Run this SQL in the Supabase SQL editor:

```sql
-- Enum types
CREATE TYPE incident_category AS ENUM (
  'WATERLOGGING', 'PROTEST', 'ACCIDENT', 'CONSTRUCTION'
);
CREATE TYPE incident_status AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE vote_direction AS ENUM ('UP', 'DOWN');

-- Main incidents table
CREATE TABLE incidents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category    incident_category NOT NULL,
  lat         FLOAT NOT NULL,
  lng         FLOAT NOT NULL,
  media_url   TEXT,
  description VARCHAR(150),
  upvotes     INT NOT NULL DEFAULT 0,
  downvotes   INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  status      incident_status NOT NULL DEFAULT 'ACTIVE',
  is_seed     BOOLEAN NOT NULL DEFAULT FALSE
);

-- Votes table (dedup by incident + voter IP hash)
CREATE TABLE votes (
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  ip_hash     TEXT NOT NULL,
  direction   vote_direction NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT votes_pkey PRIMARY KEY (incident_id, ip_hash)
);

-- Index to speed up active-incident queries
CREATE INDEX idx_incidents_expires_at ON incidents(expires_at);
CREATE INDEX idx_incidents_status ON incidents(status);
```

**TTL values** to implement in code (`lib/constants.ts`):

```ts
export const CATEGORY_TTL_HOURS: Record<string, number> = {
  ACCIDENT:      1.5,
  WATERLOGGING:  4,
  PROTEST:       3,
  CONSTRUCTION:  8,
};

export const TRUST_THRESHOLD = -4;
export const MAX_DOWNVOTE_WEIGHT = 10;
```

### Step 1.2 — Supabase Storage Bucket

In the Supabase dashboard → Storage → Create bucket named `incident-photos`:
- **Public:** Yes (so image URLs are directly usable in `<img>` tags)
- The bucket is public for *reads*, but writes only happen through the API route using the `service_role` key — the `anon` key has no upload permissions

### Step 1.3 — Supabase Server Client (`lib/supabase.ts`)

```ts
import { createClient } from '@supabase/supabase-js';

// Used in API routes only (has write access)
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

### Step 1.4 — API Route: `GET /api/incidents`

**File:** `app/api/incidents/route.ts`

Logic:
1. Query `incidents` where `expires_at > now()` AND `status = 'ACTIVE'`
2. In the SELECT, compute trust score inline:
   ```sql
   SELECT *, (upvotes - LEAST(downvotes, 10) * 2) AS trust_score
   FROM incidents
   WHERE expires_at > now()
     AND status = 'ACTIVE'
     AND (upvotes - LEAST(downvotes, 10) * 2) >= -4
   ORDER BY created_at DESC;
   ```
3. Return as JSON array

### Step 1.5 — API Route: `POST /api/incidents`

**File:** `app/api/incidents/route.ts` (same file, different method handler)

Accepts `multipart/form-data` with fields: `category`, `lat`, `lng`, `description`, `photo` (File).

Logic:
1. Parse the form data
2. Validate: category is valid enum, lat/lng are numbers, description ≤ 150 chars
3. If `photo` is present:
   - Read the file buffer
   - Upload to Supabase Storage at path `incidents/{uuid}.jpg` using `supabaseAdmin`
   - Get the public URL
4. Compute `expires_at = now() + CATEGORY_TTL_HOURS[category] hours`
5. Insert into `incidents` table
6. Return the created incident as JSON (201)

### Step 1.6 — API Route: `POST /api/incidents/[id]/vote`

**File:** `app/api/incidents/[id]/vote/route.ts`

Accepts JSON: `{ direction: 'UP' | 'DOWN' }`

Logic:
1. Get caller IP from `request.headers.get('x-forwarded-for')` (Vercel sets this)
2. SHA-256 hash the IP using Node's `crypto.createHash('sha256')`
3. Attempt insert into `votes` table with `(incident_id, ip_hash, direction)`
4. If the DB throws a unique constraint violation (code `23505`) → return `409 { error: 'already_voted' }`
5. On success, increment `upvotes` or `downvotes` on the incident row
6. Return the updated trust score

**Test all three routes with curl or Postman before moving on.**

---

## Phase 2 — Map & Pin Rendering (Day 6–8)

### Step 2.1 — Mapbox React Component (`components/Map.tsx`)

Key implementation details:
- Mark as `'use client'`
- Use `useEffect` to initialize the map once on mount — store the instance in a `useRef`
- **Do not re-initialize on re-render** — the map instance is mutable and handles its own DOM
- Accept an `incidents` prop (array) and an `onMarkerClick` callback

```tsx
'use client';
import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

export default function Map({ incidents, onMarkerClick }) {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    if (mapRef.current) return; // already initialized
    mapRef.current = new mapboxgl.Map({
      container: containerRef.current!,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [90.4125, 23.8103],
      zoom: 12,
    });
  }, []);

  // Sync markers when incidents change
  useEffect(() => {
    if (!mapRef.current) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = incidents.map(incident => {
      const el = createMarkerElement(incident); // SVG per category
      el.addEventListener('click', () => onMarkerClick(incident));
      return new mapboxgl.Marker({ element: el })
        .setLngLat([incident.lng, incident.lat])
        .addTo(mapRef.current!);
    });
  }, [incidents]);

  return <div ref={containerRef} className="w-full h-full" />;
}
```

### Step 2.2 — Category Marker Colors

| Category | Color | SVG icon |
|---|---|---|
| WATERLOGGING | `#38BDF8` (sky blue) | Water drop |
| PROTEST | `#FB923C` (orange) | Megaphone |
| ACCIDENT | `#F87171` (red) | Warning triangle |
| CONSTRUCTION | `#FBBF24` (amber) | Hard hat |

Seed pins get the same color but a smaller size and dashed border to distinguish them from live reports.

### Step 2.3 — Polling

In `app/page.tsx` (server component shell) or a client wrapper:

```tsx
useEffect(() => {
  const fetchIncidents = async () => {
    const res = await fetch('/api/incidents');
    const data = await res.json();
    setIncidents(data);
  };

  fetchIncidents(); // immediately on mount
  const interval = setInterval(fetchIncidents, 25_000); // then every 25s
  return () => clearInterval(interval);
}, []);
```

### Step 2.4 — Bottom Sheet (`components/IncidentSheet.tsx`)

Triggered when a marker is clicked. Shows:
- Category badge with color
- Photo (if present) — full width, rounded
- `"X minutes ago"` timestamp using `date-fns` or manual calculation
- Description text
- `upvotes` / `downvotes` counts
- **"Still Blocked" (👍) / "Cleared" (👎) vote buttons** — disabled after voting (track voted IDs in `localStorage`)
- "Demo report" tag if `is_seed === true`

Implement as a slide-up panel anchored to the bottom of the screen (CSS `transform: translateY`).

---

## Phase 3 — Reporting Flow (Day 9–12)

### Step 3.1 — Report Button

A fixed floating action button (bottom-right) that opens `ReportDrawer.tsx`.

### Step 3.2 — Geolocation with Fallback (`ReportDrawer.tsx`)

```ts
const getLocation = (): Promise<{lat: number, lng: number}> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject('unsupported'); return; }
    
    const timeout = setTimeout(() => reject('timeout'), 5000);
    
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timeout);
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => { clearTimeout(timeout); reject('denied'); }
    );
  });
};
```

If `getLocation()` rejects:
- Show a message: *"Enable location or tap the map to place your report"*
- Activate `TapToPlaceOverlay` — a transparent click layer over the map that captures a `lng/lat` on tap, then advances the flow

### Step 3.3 — Multi-Step Drawer Flow

```
Step 1: Location (GPS auto or tap-to-place)
Step 2: Category picker (4 large icons, single-select)
Step 3: Photo (optional) + Description (textarea, 150 char counter)
Step 4: Confirm & Submit
```

Keep state in a single `useReducer` in the drawer.

### Step 3.4 — Client-Side Image Resize (`lib/imageResize.ts`)

Use the `browser-image-compression` library:

```ts
import imageCompression from 'browser-image-compression';

export async function resizeImage(file: File): Promise<File> {
  return imageCompression(file, {
    maxSizeMB: 0.2,       // 200KB
    maxWidthOrHeight: 1024,
    useWebWorker: true,
  });
}
```

### Step 3.5 — Submission

Build a `FormData` object and POST to `/api/incidents`:

```ts
const formData = new FormData();
formData.append('category', state.category);
formData.append('lat', String(state.lat));
formData.append('lng', String(state.lng));
formData.append('description', state.description);
if (state.photo) formData.append('photo', state.photo);

const res = await fetch('/api/incidents', { method: 'POST', body: formData });
const newIncident = await res.json();
```

**Optimistic update:** Append `newIncident` to the local `incidents` state immediately so the pin appears on the map without waiting for the next poll cycle.

---

## Phase 4 — Verification & Trust Decay (Day 13–15)

### Step 4.1 — Vote API Integration

Wire vote buttons in `IncidentSheet.tsx` to:

```ts
const vote = async (direction: 'UP' | 'DOWN') => {
  const res = await fetch(`/api/incidents/${incident.id}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ direction }),
  });

  if (res.status === 409) {
    // Already voted — disable buttons, show toast
    return;
  }
  // Update local counts optimistically
};
```

Persist voted incident IDs in `localStorage` (`voted_incidents: string[]`) so buttons stay disabled across refreshes.

### Step 4.2 — Trust Score Filtering

The `GET /api/incidents` route already excludes low-trust pins via SQL. The client doesn't need to re-filter — when the next poll fires, expired/downvoted pins simply won't be in the response and markers will be removed.

### Step 4.3 — (Stretch) "Near Me" Banner

If the user has granted geolocation, check each incident's distance from the user's coords using the Haversine formula. If within 500m, show a subtle banner on that incident's bottom sheet: *"You're nearby — is this still blocked?"*

```ts
function haversineMeters(lat1, lng1, lat2, lng2): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
    Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
```

---

## Phase 5 — Polish, Seed Data & Demo Prep (Day 16–18)

### Step 5.1 — Seed Script (`scripts/seed.ts`)

Run once with `npx tsx scripts/seed.ts` to insert 15–20 realistic incidents:

```ts
const seedIncidents = [
  { category: 'WATERLOGGING', lat: 23.7908, lng: 90.3561, description: 'Knee-deep flooding after rain', area: 'Mirpur-10' },
  { category: 'ACCIDENT',     lat: 23.7936, lng: 90.4066, description: 'CNG overturned, one lane blocked', area: 'Mohakhali' },
  { category: 'PROTEST',      lat: 23.7461, lng: 90.3742, description: 'Student rally at Dhanmondi 27', area: 'Dhanmondi' },
  { category: 'CONSTRUCTION', lat: 23.7934, lng: 90.4149, description: 'RAJUK road excavation, use service road', area: 'Gulshan-1' },
  // ... 15–20 total
];
```

Each seed row gets `is_seed: true` and a realistic `expires_at` far in the future (e.g., 30 days) so they persist through demos.

### Step 5.2 — Seed Data Visual Treatment

In `IncidentMarker.tsx`, if `incident.is_seed`:
- Render the marker at 80% size
- Add a dashed stroke border

In `IncidentSheet.tsx`, if `is_seed`:
- Show a small grey badge: **"Demo report"**

This way, visitors understand the map is pre-populated for illustration purposes.

### Step 5.3 — UI Polish Checklist

- [ ] Dark map style (`mapbox://styles/mapbox/dark-v11`) for a modern look
- [ ] Bottom sheet slides up with CSS `transition: transform 0.3s ease`
- [ ] Report drawer: step indicator (dots, 1–4)
- [ ] Photo is **required** to submit — show clear validation error if missing; the Step 3 "Next" button stays disabled until a photo is attached
- [ ] All interactive elements have min 44×44px tap targets (mobile)
- [ ] Toast notifications for: "Report submitted!", "Thanks for voting!", "Already voted"
- [ ] Loading skeleton while incidents are fetching on first load
- [ ] Error state: "Could not load incidents. Tap to retry."
- [ ] Empty state (should never show with seed data, but just in case)
- [ ] `<meta name="viewport" content="width=device-width, initial-scale=1">` — ensure mobile scaling
- [ ] App title and meta description set in `app/layout.tsx`

---

## Phase 6 — Deployment & Documentation (Day 19–21)

### Step 6.1 — Final Deployment Checks

- [ ] All 3 env vars set in Vercel (Mapbox token, Supabase URL, anon key, service role key)
- [ ] Supabase Storage bucket is public for reads
- [ ] Supabase Row Level Security (RLS):
  - `incidents` table: allow SELECT for all (anon); INSERT/UPDATE only via service role (API route)
  - `votes` table: no client access (API route only)
- [ ] Test report flow on a real mobile device (not just DevTools emulation)
- [ ] Test voting dedup (vote twice on same incident — should get "already voted")
- [ ] Verify expired incidents disappear (manually set an `expires_at` in the past in Supabase)

### Step 6.2 — README Structure

```
# Dhaka Traffic Context Tracker
> Live demo: [link]

## What it does
## Why I built it
## Tech stack (with badge icons)
## Architecture diagram
## Screenshots / GIF
## How to run locally
## Data schema
## Decisions & trade-offs
```

### Step 6.3 — Demo Video Script (60–90s)

1. (0–10s) Open the app, show the map with seeded pins
2. (10–30s) Click a pin → show bottom sheet with photo, description, vote buttons
3. (30–55s) Tap "Report" → allow GPS → pick "Waterlogging" → snap/upload photo → submit → watch pin appear
4. (55–75s) Vote "Cleared" on an incident → explain trust score in narration
5. (75–90s) Show the code briefly — schema, API route, Map component

---

## Data Flow Summary

```
Browser                     Next.js API Route           Supabase
  │                               │                         │
  │── GET /api/incidents ─────────►                         │
  │                               │── SELECT incidents ─────►
  │                               │◄─ rows ─────────────────│
  │◄─ JSON (active, trusted) ─────│                         │
  │                               │                         │
  │── POST /api/incidents ────────►                         │
  │   (FormData: photo+meta)      │── upload photo ─────────►
  │                               │── INSERT incident ──────►
  │◄─ 201 + new incident ─────────│                         │
  │                               │                         │
  │── POST /api/incidents/:id/vote►                         │
  │   { direction: 'DOWN' }       │── INSERT vote ──────────►
  │                               │   (unique constraint)   │
  │                               │── UPDATE downvotes ─────►
  │◄─ 200 / 409 already_voted ────│                         │
```

---

## Decisions Locked In

| Decision | Choice | Rationale |
|---|---|---|
| Styling | Tailwind CSS | Faster to prototype; utility-first works well with component-based architecture |
| Seed data expiry | `null` (`expires_at` = null) | Always visible for demos; query filter updated to `expires_at IS NULL OR expires_at > now()` |
| Photo on submit | Required | Richer data; photo is the clearest way to demonstrate a real incident |
| Map style | `dark-v11` | Modern, premium look that makes colored markers pop |
