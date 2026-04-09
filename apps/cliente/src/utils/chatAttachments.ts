import { uploadToStorage } from './uploadToStorage';
import { CHAT_ATTACHMENTS_BUCKET } from './storageUrl';

export function makeChatAttachmentPath(conversationId: string, extension: string): string {
  const safeExt = extension.replace(/^\./, '').replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'bin';
  const id =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  return `${conversationId}/${id}.${safeExt}`;
}

export async function uploadChatLocalFile(
  conversationId: string,
  localUri: string,
  contentType: string,
  extension: string,
): Promise<string> {
  const path = makeChatAttachmentPath(conversationId, extension);
  await uploadToStorage(CHAT_ATTACHMENTS_BUCKET, path, localUri, contentType);
  return path;
}
