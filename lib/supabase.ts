import { createClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase admin client.
 * Uses the service_role key — grants full DB and Storage access.
 * NEVER import this in client components.
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
