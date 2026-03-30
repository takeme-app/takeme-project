import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

export function createSupabaseClient(
  url: string,
  anonKey: string,
  options?: Parameters<typeof createClient<Database>>[2],
) {
  return createClient<Database>(url, anonKey, options);
}
