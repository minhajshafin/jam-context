import { MAX_DOWNVOTE_WEIGHT } from './constants';

/**
 * Computes the trust score for an incident.
 * Downvote weight is capped to prevent spam suppression.
 */
export function trustScore(upvotes: number, downvotes: number): number {
  const effectiveDownvotes = Math.min(downvotes, MAX_DOWNVOTE_WEIGHT);
  return upvotes - effectiveDownvotes * 2;
}
