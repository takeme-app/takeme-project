import { supabase } from '../lib/supabase';

/** Resolve path relativo do bucket ou URL absoluta. */
export function storageUrl(bucket: string, pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl) return null;
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) return pathOrUrl;
  const { data } = supabase.storage.from(bucket).getPublicUrl(pathOrUrl);
  return data.publicUrl;
}

const CHAT_ATTACHMENT_SIGNED_TTL_SEC = 3600;
export const CHAT_ATTACHMENTS_BUCKET = 'chat-attachments';

export async function chatAttachmentSignedUrl(path: string | null | undefined): Promise<string | null> {
  const p = path?.trim();
  if (!p) return null;
  const { data, error } = await supabase.storage
    .from(CHAT_ATTACHMENTS_BUCKET)
    .createSignedUrl(p, CHAT_ATTACHMENT_SIGNED_TTL_SEC);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
