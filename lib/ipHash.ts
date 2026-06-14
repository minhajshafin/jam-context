import { createHash } from 'crypto';

/**
 * Returns a SHA-256 hex hash of the given IP address string.
 * The raw IP is never stored — only the hash.
 */
export function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex');
}

/**
 * Extracts the caller's IP from a Next.js Request object.
 * Falls back to '0.0.0.0' if no IP can be determined (e.g. local dev).
 */
export function getIpFromRequest(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // x-forwarded-for can be a comma-separated list; take the first entry
    return forwarded.split(',')[0].trim();
  }
  return '0.0.0.0';
}
