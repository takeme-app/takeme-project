export type ParsedEdgeFunctionResponse = {
  success: boolean;
  errorMessage: string;
};

/**
 * Lê o corpo de uma Edge Function uma vez (.text()) e interpreta JSON ou texto bruto.
 */
export async function parseEdgeFunctionResponse(res: Response): Promise<ParsedEdgeFunctionResponse> {
  const rawText = await res.text().catch(() => '');
  if (!rawText.trim()) {
    return {
      success: res.ok,
      errorMessage: res.ok ? '' : `Resposta vazia do servidor (${res.status}).`,
    };
  }

  let data: { ok?: boolean; error?: unknown; message?: unknown };
  try {
    data = JSON.parse(rawText) as { ok?: boolean; error?: unknown; message?: unknown };
  } catch {
    return {
      success: false,
      errorMessage: res.ok ? '' : rawText.trim().slice(0, 500) || `Erro ${res.status}`,
    };
  }

  const fromNested =
    data.error && typeof data.error === 'object' && data.error !== null && 'message' in data.error
      ? String((data.error as { message?: unknown }).message ?? '').trim()
      : '';

  const err =
    (typeof data.error === 'string' ? data.error.trim() : '') ||
    fromNested ||
    (typeof data.message === 'string' ? data.message.trim() : '');

  if (err) {
    return { success: false, errorMessage: err };
  }

  const success = res.ok && data.ok === true;
  return {
    success,
    errorMessage: success ? '' : rawText.trim().slice(0, 500) || `Erro ${res.status}`,
  };
}
