import { supabase } from '../lib/supabase';

/**
 * Resolve um valor de storage para URL pública.
 * Aceita tanto caminhos relativos ("userId/avatar.jpg") quanto URLs completas.
 */
export function storageUrl(bucket: string, pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl) return null;
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) return pathOrUrl;
  const { data } = supabase.storage.from(bucket).getPublicUrl(pathOrUrl);
  return data.publicUrl;
}

/** Bucket usado no cadastro (FinalizeRegistration) para fotos/documentos do veículo. */
export const VEHICLE_PHOTOS_STORAGE_BUCKET = 'driver-documents';

const VEHICLE_PHOTO_SIGNED_EXPIRY_SEC = 3600;

/**
 * URL pública para itens em `vehicle_photos_urls`: caminhos do cadastro vivem em driver-documents;
 * uploads pelo formulário de veículo podem já vir como URL completa.
 */
export function vehiclePhotoPublicUrl(pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl) return null;
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) return pathOrUrl;
  return storageUrl(VEHICLE_PHOTOS_STORAGE_BUCKET, pathOrUrl);
}

/** Extrai bucket e path de URLs no formato público do Supabase Storage. */
export function parseSupabaseStoragePublicUrl(urlString: string): { bucket: string; path: string } | null {
  try {
    const base = urlString.split('?')[0] ?? urlString;
    const u = new URL(base);
    const marker = '/storage/v1/object/public/';
    const idx = u.pathname.indexOf(marker);
    if (idx === -1) return null;
    const rest = u.pathname.slice(idx + marker.length);
    const slash = rest.indexOf('/');
    if (slash <= 0) return null;
    const bucket = decodeURIComponent(rest.slice(0, slash));
    const path = decodeURIComponent(rest.slice(slash + 1).replace(/^\/+/, ''));
    if (!bucket || !path) return null;
    return { bucket, path };
  } catch {
    return null;
  }
}

export function normalizeVehiclePhotosUrls(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
  }
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return [];
    try {
      const p = JSON.parse(t) as unknown;
      return normalizeVehiclePhotosUrls(p);
    } catch {
      return [t];
    }
  }
  return [];
}

/**
 * URL utilizável no app para exibir fotos do veículo.
 * O bucket driver-documents é privado: é necessário signed URL (JWT do usuário).
 */
export async function resolveVehiclePhotoUri(pathOrUrl: string | null | undefined): Promise<string | null> {
  const raw = pathOrUrl?.trim();
  if (!raw) return null;

  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    const parsed = parseSupabaseStoragePublicUrl(raw);
    if (parsed) {
      const { data, error } = await supabase.storage
        .from(parsed.bucket)
        .createSignedUrl(parsed.path, VEHICLE_PHOTO_SIGNED_EXPIRY_SEC);
      if (!error && data?.signedUrl) return data.signedUrl;
    }
    return raw;
  }

  for (const bucket of [VEHICLE_PHOTOS_STORAGE_BUCKET, 'vehicles'] as const) {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(raw, VEHICLE_PHOTO_SIGNED_EXPIRY_SEC);
    if (!error && data?.signedUrl) return data.signedUrl;
  }

  return vehiclePhotoPublicUrl(raw);
}

export async function resolveVehiclePhotoUris(pathsOrUrls: string[]): Promise<(string | null)[]> {
  return Promise.all(pathsOrUrls.map((p) => resolveVehiclePhotoUri(p)));
}

const CHAT_ATTACHMENT_SIGNED_TTL_SEC = 3600;
export const CHAT_ATTACHMENTS_BUCKET = 'chat-attachments';

/** URL assinada para anexos do chat (bucket privado `chat-attachments`). */
export async function chatAttachmentSignedUrl(path: string | null | undefined): Promise<string | null> {
  const p = path?.trim();
  if (!p) return null;
  const { data, error } = await supabase.storage
    .from(CHAT_ATTACHMENTS_BUCKET)
    .createSignedUrl(p, CHAT_ATTACHMENT_SIGNED_TTL_SEC);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
