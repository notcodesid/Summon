import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Supabase browser / mobile client.
 *
 * Uses only public keys (EXPO_PUBLIC_*). Never put the database password
 * or service_role key in the app — those stay on servers / local scripts.
 */
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''

export const isSupabaseConfigured =
  supabaseUrl.length > 0 && supabaseAnonKey.length > 0

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env',
    )
  }
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // No auth flow yet — keep session storage ready for later.
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  }
  return client
}
