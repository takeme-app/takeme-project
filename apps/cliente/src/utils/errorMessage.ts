/**
 * Converte mensagens de erro (Supabase, rede, etc.) para português do Brasil
 * para exibição ao usuário. Evita mostrar mensagens técnicas em inglês.
 */
const SUPABASE_PT: Array<{ pattern: RegExp | string; message: string }> = [
  [/invalid login credentials|invalid_credentials/i, 'E-mail ou senha incorretos. Tente novamente.'],
  [/email not confirmed/i, 'E-mail ainda não confirmado. Verifique sua caixa de entrada.'],
  [/user already registered|already exists|already registered/i, 'Este e-mail já está cadastrado. Faça login ou use outro e-mail.'],
  [/password should be at least|password.*at least \d/i, 'A senha deve ter no mínimo 6 caracteres.'],
  [/unable to validate email|invalid email/i, 'E-mail inválido. Verifique e tente novamente.'],
  [/token has expired|expired/i, 'Link ou código expirado. Solicite um novo.'],
  [/network request failed|failed to fetch|network error/i, 'Sem conexão. Verifique a internet e tente novamente.'],
  [/session.*expired|refresh token/i, 'Sessão expirada. Faça login novamente.'],
  [/duplicate key|unique constraint|23505/i, 'Este dado já está em uso. Use outro valor.'],
  [/foreign key|violates foreign key/i, 'Não foi possível concluir. Verifique os dados.'],
  [/bucket.*not found|storage.*not found/i, 'Serviço de armazenamento indisponível. Tente mais tarde.'],
  [/row-level security|policy/i, 'Você não tem permissão para esta ação.'],
  [/jwt expired/i, 'Sessão expirada. Faça login novamente.'],
  [/edge function|non-2xx/i, 'Serviço temporariamente indisponível. Tente novamente.'],
];

const DEFAULT_MESSAGE = 'Algo deu errado. Tente novamente.';

function getMessageFromError(error: unknown): string {
  if (error == null) return '';
  if (typeof error === 'string') return error.trim();
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const msg = String((error as { message: unknown }).message).trim();
    if (msg) return msg;
  }
  return '';
}

/**
 * Retorna uma mensagem em português (BR) adequada para exibir ao usuário.
 * @param error - Erro capturado (try/catch) ou objeto com .message
 * @param fallback - Mensagem padrão quando não houver mapeamento (opcional)
 */
export function getUserErrorMessage(error: unknown, fallback: string = DEFAULT_MESSAGE): string {
  const raw = getMessageFromError(error);
  if (!raw) return fallback;

  const lower = raw.toLowerCase();
  for (const { pattern, message } of SUPABASE_PT) {
    if (typeof pattern === 'string') {
      if (lower.includes(pattern.toLowerCase())) return message;
    } else if (pattern.test(raw) || pattern.test(lower)) {
      return message;
    }
  }

  return fallback;
}
