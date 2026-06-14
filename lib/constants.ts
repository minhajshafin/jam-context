import type { IncidentCategory } from '@/types';

// TTL in hours per incident category
export const CATEGORY_TTL_HOURS: Record<IncidentCategory, number> = {
  ACCIDENT:      1.5,
  WATERLOGGING:  4,
  PROTEST:       3,
  CONSTRUCTION:  8,
};

// Trust score threshold — pins below this are hidden
export const TRUST_THRESHOLD = -4;

// Max downvote weight counted in trust score (prevents spam suppression)
export const MAX_DOWNVOTE_WEIGHT = 10;

// Polling interval in ms
export const POLL_INTERVAL_MS = 25_000;

// Geolocation timeout in ms before falling back to tap-to-place
export const GEO_TIMEOUT_MS = 5_000;

// Description character limit
export const DESCRIPTION_MAX_CHARS = 150;

// "Near me" radius in metres for the proximity banner
export const NEARBY_RADIUS_METRES = 500;

// Map config — CARTO dark-matter GL style (free, no account, no API key)
export const MAPBOX_CENTER: [number, number] = [90.4125, 23.8103]; // Dhaka
export const MAPBOX_ZOOM = 12;
export const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

// Category display metadata
export const CATEGORY_META: Record<
  IncidentCategory,
  { label: string; color: string; emoji: string }
> = {
  WATERLOGGING:  { label: 'Waterlogging',  color: '#38BDF8', emoji: '💧' },
  PROTEST:       { label: 'Protest',        color: '#FB923C', emoji: '📢' },
  ACCIDENT:      { label: 'Accident',       color: '#F87171', emoji: '⚠️' },
  CONSTRUCTION:  { label: 'Road Damage',    color: '#FBBF24', emoji: '🚧' },
};
