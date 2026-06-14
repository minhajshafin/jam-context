import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hashIp, getIpFromRequest } from '@/lib/ipHash';
import { trustScore } from '@/lib/trustScore';
import type { VoteDirection } from '@/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  let direction: VoteDirection;
  try {
    const body = await request.json();
    direction = body.direction;
    if (direction !== 'UP' && direction !== 'DOWN') throw new Error();
  } catch {
    return NextResponse.json({ error: 'direction must be UP or DOWN' }, { status: 400 });
  }

  // Hash the caller's IP for anonymous dedup
  const rawIp = getIpFromRequest(request);
  const ipHash = hashIp(rawIp);

  // Attempt to insert vote (unique constraint on incident_id + ip_hash)
  const { error: voteError } = await supabaseAdmin
    .from('votes')
    .insert({ incident_id: id, ip_hash: ipHash, direction });

  if (voteError) {
    // Postgres unique constraint violation code
    if (voteError.code === '23505') {
      return NextResponse.json({ error: 'already_voted' }, { status: 409 });
    }
    // FK violation — incident not found
    if (voteError.code === '23503') {
      return NextResponse.json({ error: 'incident_not_found' }, { status: 404 });
    }
    return NextResponse.json({ error: voteError.message }, { status: 500 });
  }

  // Increment the appropriate counter on the incident
  const column = direction === 'UP' ? 'upvotes' : 'downvotes';

  const { data: incident, error: fetchError } = await supabaseAdmin
    .from('incidents')
    .select('upvotes, downvotes')
    .eq('id', id)
    .single();

  if (fetchError || !incident) {
    return NextResponse.json({ error: 'incident_not_found' }, { status: 404 });
  }

  const newValue = (incident[column] as number) + 1;

  const { error: updateError } = await supabaseAdmin
    .from('incidents')
    .update({ [column]: newValue })
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const updatedUpvotes = direction === 'UP' ? newValue : incident.upvotes;
  const updatedDownvotes = direction === 'DOWN' ? newValue : incident.downvotes;

  return NextResponse.json({
    trust_score: trustScore(updatedUpvotes, updatedDownvotes),
    upvotes: updatedUpvotes,
    downvotes: updatedDownvotes,
  });
}
