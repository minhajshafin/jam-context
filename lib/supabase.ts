import { createClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase admin client.
 * Uses the "Secret" key (previously called service_role) from:
 * Supabase dashboard → Project Settings → API → Secret key
 *
 * Grants full DB and Storage access, bypassing RLS.
 * NEVER import this in client components or expose it to the browser.
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
