-- ============================================================
-- Dhaka Traffic Context Tracker — Supabase Schema
-- Run this in the Supabase SQL editor (once, on a fresh project)
-- ============================================================

-- Enum types
CREATE TYPE incident_category AS ENUM (
  'WATERLOGGING', 'PROTEST', 'ACCIDENT', 'CONSTRUCTION'
);
CREATE TYPE incident_status AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE vote_direction AS ENUM ('UP', 'DOWN');

-- ─── incidents ───────────────────────────────────────────────
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
  expires_at  TIMESTAMPTZ,              -- NULL = never expires (seed data)
  status      incident_status NOT NULL DEFAULT 'ACTIVE',
  is_seed     BOOLEAN NOT NULL DEFAULT FALSE
);

-- Speed up active-incident queries
CREATE INDEX idx_incidents_expires_at ON incidents(expires_at);
CREATE INDEX idx_incidents_status     ON incidents(status);
CREATE INDEX idx_incidents_category   ON incidents(category);

-- ─── votes ───────────────────────────────────────────────────
CREATE TABLE votes (
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  ip_hash     TEXT NOT NULL,
  direction   vote_direction NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Unique constraint: one vote per IP per incident (enforced at DB level)
  CONSTRAINT votes_pkey PRIMARY KEY (incident_id, ip_hash)
);

-- ─── Row Level Security ───────────────────────────────────────
-- incidents: public reads; all writes go through the service-role API route
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_public_read"
  ON incidents FOR SELECT TO anon USING (true);

-- votes: no direct client access — all writes go through the service-role API route
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
-- (no SELECT/INSERT policy for anon — API route uses service_role which bypasses RLS)
