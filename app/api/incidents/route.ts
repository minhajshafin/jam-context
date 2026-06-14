import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { CATEGORY_TTL_HOURS, TRUST_THRESHOLD, MAX_DOWNVOTE_WEIGHT } from '@/lib/constants';
import type { IncidentCategory } from '@/types';

const VALID_CATEGORIES: IncidentCategory[] = [
  'WATERLOGGING', 'PROTEST', 'ACCIDENT', 'CONSTRUCTION',
];

// ─── GET /api/incidents ───────────────────────────────────────────────────────
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('incidents')
    .select('*')
    .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Filter by trust score (computed here since Supabase JS client
  // doesn't support computed column filtering inline)
  const filtered = (data ?? []).filter((incident) => {
    const effectiveDownvotes = Math.min(incident.downvotes, MAX_DOWNVOTE_WEIGHT);
    const score = incident.upvotes - effectiveDownvotes * 2;
    return score >= TRUST_THRESHOLD;
  }).map((incident) => {
    const effectiveDownvotes = Math.min(incident.downvotes, MAX_DOWNVOTE_WEIGHT);
    return {
      ...incident,
      trust_score: incident.upvotes - effectiveDownvotes * 2,
    };
  });

  return NextResponse.json(filtered);
}

// ─── POST /api/incidents ──────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const category = formData.get('category') as string;
  const lat = parseFloat(formData.get('lat') as string);
  const lng = parseFloat(formData.get('lng') as string);
  const description = (formData.get('description') as string) ?? '';
  const photo = formData.get('photo') as File | null;

  // Validate
  if (!VALID_CATEGORIES.includes(category as IncidentCategory)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
  }
  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
  }
  if (description.length > 150) {
    return NextResponse.json({ error: 'Description too long' }, { status: 400 });
  }
  if (!photo) {
    return NextResponse.json({ error: 'Photo is required' }, { status: 400 });
  }

  // Upload photo to Supabase Storage (server-side — service role key)
  const photoBuffer = Buffer.from(await photo.arrayBuffer());
  const fileName = `incidents/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from('incident-photos')
    .upload(fileName, photoBuffer, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: 'Photo upload failed' }, { status: 500 });
  }

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from('incident-photos')
    .getPublicUrl(fileName);

  // Compute expiry
  const ttlHours = CATEGORY_TTL_HOURS[category as IncidentCategory];
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();

  // Insert incident
  const { data, error } = await supabaseAdmin
    .from('incidents')
    .insert({
      category,
      lat,
      lng,
      media_url: publicUrl,
      description: description || null,
      expires_at: expiresAt,
      is_seed: false,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ...data, trust_score: 0 }, { status: 201 });
}
