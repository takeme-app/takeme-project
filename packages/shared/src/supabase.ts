import { createClient, type CreateClientOptions } from '@supabase/supabase-js';
import type { Database } from './types';

export function createSupabaseClient(url: string, anonKey: string, options?: CreateClientOptions) {
  return createClient<Database>(url, anonKey, options);
}
