/**
 * Converte mensagens de erro (Supabase, rede, etc.) para português do Brasil
 * para exibição ao usuário. Evita mostrar mensagens técnicas em inglês.
 */
const ERROR_PT: Array<[RegExp, string]> = [
  [/invalid login credentials|invalid_credentials/i, 'E-mail ou senha incorretos. Tente novamente.'],
  [/email not confirmed/i, 'E-mail ainda não confirmado. Verifique sua caixa de entrada.'],
  [/user already registered|already exists|already registered/i, 'Este e-mail já está cadastrado. Faça login ou use outro e-mail.'],
  [/password should be at least|password.*at least \d/i, 'A senha deve ter no mínimo 6 caracteres.'],
  [/unable to validate email|invalid email/i, 'E-mail inválido. Verifique e tente novamente.'],
  [/token has expired|expired/i, 'Link ou código expirado. Solicite um novo.'],
  [/network request failed|failed to fetch|network error/i, 'Sem conexão. Verifique a internet e tente novamente.'],
  [/rate limit|rate_limit|too many requests|429|email.*hour|password reset.*period/i, 'Aguarde alguns minutos para solicitar um novo e-mail de recuperação.'],
  [/session.*expired|refresh token/i, 'Sessão expirada. Faça login novamente.'],
  [/jwt expired/i, 'Sessão expirada. Faça login novamente.'],
  [/invalid jwt|jwt could not be verified|jwt.*not.*valid/i, 'Sessão inválida ou expirada. Faça login novamente.'],
  [/edge function|non-2xx/i, 'Serviço temporariamente indisponível. Tente novamente.'],
  // Storage / anexos (Supabase)
  [
    /row-level security|violates row-level|new row violates|rls|unauthorized|403/i,
    'Sem permissão para enviar o arquivo (conversa encerrada ou política do servidor). Verifique se o chat está ativo ou fale com o suporte.',
  ],
  [/bucket not found|bucket does not exist|not found.*bucket/i, 'O armazenamento de anexos ainda não foi configurado no servidor (bucket chat-attachments).'],
  [/payload too large|entity too large|413|file too large|maximum.*size/i, 'Arquivo muito grande. Tente uma imagem menor ou outro formato.'],
  [/invalid.*mime|mime type|content-type/i, 'Formato de arquivo não aceito. Tente JPG, PNG ou outro tipo suportado.'],
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
 */
export function getUserErrorMessage(error: unknown, fallback: string = DEFAULT_MESSAGE): string {
  const raw = getMessageFromError(error);
  if (!raw) return fallback;

  const lower = raw.toLowerCase();
  for (const [pattern, message] of ERROR_PT) {
    if (pattern.test(raw) || pattern.test(lower)) {
      return message;
    }
  }

  // Mensagens não mapeadas: mostrar o texto original (ex.: erro do Storage), não esconder atrás do genérico.
  return raw.length > 0 ? raw : fallback;
}
