import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { createSupabaseClient } from '@take-me/shared';

type SupabaseExtra = { supabaseUrl?: string; supabaseAnonKey?: string };

function readSupabaseExtra(): SupabaseExtra {
  const c = Constants.expoConfig;
  if (c?.extra && typeof c.extra === 'object') return c.extra as SupabaseExtra;
  const legacy = Constants.manifest as { extra?: SupabaseExtra } | null;
  if (legacy?.extra) return legacy.extra;
  return {};
}

const extra = readSupabaseExtra();

const supabaseUrl =
  (typeof extra.supabaseUrl === 'string' ? extra.supabaseUrl : '') ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  '';

const supabaseAnonKey =
  (typeof extra.supabaseAnonKey === 'string' ? extra.supabaseAnonKey : '') ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  '';

export const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const isSupabaseConfigured =
  Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('https://'));
