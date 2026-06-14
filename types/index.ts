export type IncidentCategory =
  | 'WATERLOGGING'
  | 'PROTEST'
  | 'ACCIDENT'
  | 'CONSTRUCTION';

export type IncidentStatus = 'ACTIVE' | 'ARCHIVED';

export type VoteDirection = 'UP' | 'DOWN';

export interface Incident {
  id: string;
  category: IncidentCategory;
  lat: number;
  lng: number;
  media_url: string | null;
  description: string | null;
  upvotes: number;
  downvotes: number;
  created_at: string;
  expires_at: string | null;
  status: IncidentStatus;
  is_seed: boolean;
  trust_score?: number;
}

export interface Vote {
  incident_id: string;
  ip_hash: string;
  direction: VoteDirection;
  created_at: string;
}

export interface VoteResponse {
  trust_score: number;
  upvotes: number;
  downvotes: number;
}

export interface CreateIncidentPayload {
  category: IncidentCategory;
  lat: number;
  lng: number;
  description: string;
  photo: File;
}
