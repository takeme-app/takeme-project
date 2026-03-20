/**
 * Normaliza o retorno de supabase.functions.invoke (objeto JSON ou string JSON).
 */
export function parseInvokeData(data: unknown): Record<string, unknown> | null {
  if (data == null) return null;
  if (typeof data === 'string') {
    try {
      const parsed: unknown = JSON.parse(data);
      return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  if (typeof data === 'object' && data !== null) return data as Record<string, unknown>;
  return null;
}

function hasJsonMethod(x: unknown): x is { json: () => Promise<unknown> } {
  return typeof x === 'object' && x !== null && typeof (x as { json?: unknown }).json === 'function';
}

/** Monta mensagem a partir do corpo JSON da edge ({ error, details }). */
export function formatEdgeFunctionBody(body: unknown): string | null {
  if (body == null) return null;
  if (typeof body === 'string' && body.trim()) return body.trim();
  if (typeof body !== 'object' || body === null) return null;
  const o = body as Record<string, unknown>;
  const err = o.error != null ? String(o.error).trim() : '';
  const det = o.details != null ? String(o.details).trim() : '';
  if (err && det) return `${err}\n\n${det}`;
  if (err) return err;
  if (det) return det;
  return null;
}

/**
 * Lê o corpo da resposta HTTP quando invoke falha (status não-2xx).
 * @supabase/supabase-js v2: FunctionsHttpError usa context.response (fetch Response).
 */
export async function parseInvokeError(fnError: unknown): Promise<string | null> {
  const err = fnError as {
    context?: unknown;
    message?: string;
  };

  const ctx = err?.context;

  // Formato atual: { response: Response }
  if (ctx && typeof ctx === 'object' && 'response' in ctx) {
    const response = (ctx as { response: unknown }).response;
    if (hasJsonMethod(response)) {
      try {
        const body = await response.json();
        const formatted = formatEdgeFunctionBody(body);
        if (formatted) return formatted;
      } catch {
        if (typeof (response as { text?: () => Promise<string> }).text === 'function') {
          try {
            const t = await (response as { text: () => Promise<string> }).text();
            if (t?.trim()) return t.trim();
          } catch {
            /* ignore */
          }
        }
      }
    }
  }

  // context é a própria Response (algumas versões / ambientes)
  if (hasJsonMethod(ctx)) {
    try {
      const body = await ctx.json();
      const formatted = formatEdgeFunctionBody(body);
      if (formatted) return formatted;
    } catch {
      /* ignore */
    }
  }

  // Legado: context.json()
  if (ctx && typeof ctx === 'object' && typeof (ctx as { json?: unknown }).json === 'function') {
    try {
      const body = await (ctx as { json: () => Promise<unknown> }).json();
      const formatted = formatEdgeFunctionBody(body);
      if (formatted) return formatted;
    } catch {
      /* ignore */
    }
  }

  if (
    ctx &&
    typeof ctx === 'object' &&
    (ctx as { body?: unknown }).body &&
    typeof (ctx as { body: unknown }).body === 'object' &&
    (ctx as { body: unknown }).body !== null
  ) {
    const formatted = formatEdgeFunctionBody((ctx as { body: unknown }).body);
    if (formatted) return formatted;
  }

  return null;
}

/**
 * Mensagem útil quando invoke retorna erro (combina data + FunctionsHttpError).
 * Em alguns casos o JSON de erro vem em `data` mesmo com `error` preenchido.
 */
export async function describeInvokeFailure(
  fnData: unknown,
  fnError: unknown
): Promise<string> {
  const fromData = formatEdgeFunctionBody(parseInvokeData(fnData));
  if (fromData) return fromData;

  const fromErr = await parseInvokeError(fnError);
  if (fromErr) return fromErr;

  const msg =
    fnError && typeof fnError === 'object' && typeof (fnError as { message?: string }).message === 'string'
      ? (fnError as { message: string }).message.trim()
      : '';
  if (msg && msg !== 'Edge function returned a non-2xx status code') return msg;

  return [
    'A função create-motorista-account respondeu com erro (HTTP não-2xx).',
    'Abra o painel Supabase → Edge Functions → create-motorista-account → Logs.',
    'Confira também deploy, secrets (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) e JWT da função.',
  ].join(' ');
}
