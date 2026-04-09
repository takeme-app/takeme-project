import { supabase } from '../lib/supabase';

/**
 * Upload via FormData + fetch (React Native).
 */
export async function uploadToStorage(
  bucket: string,
  storagePath: string,
  localUri: string,
  contentType: string,
): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Usuário não autenticado.');

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

  const fileName = storagePath.split('/').pop() ?? 'upload';
  const formData = new FormData();
  formData.append('file', { uri: localUri, name: fileName, type: contentType } as unknown as Blob);

  const res = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${storagePath}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'x-upsert': 'true',
    },
    body: formData,
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(errJson.message ?? `Upload falhou: ${res.status}`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  return `${data.publicUrl}?t=${Date.now()}`;
}
