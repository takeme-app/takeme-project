import Constants from 'expo-constants';
import { createSupabaseClient } from '@take-me/shared';

// Lê de extra (app.config.js carrega .env em Node) — funciona local e na Vercel
const extra = Constants.expoConfig?.extra as { supabaseUrl?: string; supabaseAnonKey?: string } | undefined;
const supabaseUrl = extra?.supabaseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = extra?.supabaseAnonKey ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

const configured =
  Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('https://'));

// Só cria o client com URL/key reais; senão usa placeholders para não quebrar (Supabase exige URL)
const url = configured ? supabaseUrl : 'https://placeholder.supabase.co';
const key = configured ? supabaseAnonKey : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

export const supabase = createSupabaseClient(url, key, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export const isSupabaseConfigured = configured;
