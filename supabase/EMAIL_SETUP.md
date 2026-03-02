# Envio de e-mails – Take Me

O app usa e-mail em **dois fluxos**. Se os seus amigos não estão recebendo, confira os itens abaixo.

---

## 1. Cadastro (código de verificação no e-mail)

Quem se cadastra com **e-mail** recebe um código de 4 dígitos. Esse e-mail é enviado pela Edge Function `send-email-verification-code`, que usa o **Resend**.

### O que pode estar errado

- **RESEND_API_KEY não está configurada** no Supabase. Sem ela, o código **não é enviado por e-mail** (só aparece nos logs da função no Dashboard).

### O que fazer

1. No **Supabase** defina os secrets (na raiz do repositório, com o projeto já linkado: `npx supabase link`):
   ```bash
   npx supabase secrets set RESEND_API_KEY=re_SUA_CHAVE_RESEND RESEND_FROM_EMAIL="Take Me <noreply@takeme.app.br>"
   ```
   Troque `re_SUA_CHAVE_RESEND` pela API Key que você gerou no Resend. O domínio `takeme.app.br` deve estar verificado no Resend para o envio funcionar para qualquer e-mail.
2. Confirme que as Edge Functions estão em produção (código de verificação e boas-vindas usam esses secrets):
   ```bash
   npm run deploy:functions
   ```
   E que a migration da tabela `email_verification_codes` está aplicada – veja `supabase/README.md`.

### Erro "Serviço de envio de código temporariamente indisponível"

Esse aviso aparece quando a Edge Function é chamada mas responde com erro (4xx/5xx). Faça na ordem:

1. **Garantir que a tabela existe no Supabase** (na raiz do repo, com o projeto linkado):
   ```bash
   npx supabase db push
   ```
   Ou no Dashboard: **SQL Editor** → cole o conteúdo de `supabase/migrations/20250223000000_create_email_verification_codes.sql` → Run.

2. **Implantar a Edge Function**:
   ```bash
   npx supabase functions deploy send-email-verification-code --no-verify-jwt
   ```
   Confirme que o projeto está linkado (`npx supabase link` se precisar).

3. **Ver o motivo do erro**: no Dashboard do Supabase → **Edge Functions** → `send-email-verification-code` → **Logs**. Tente cadastrar de novo e veja a mensagem (ex.: insert error, Resend 4xx).

### Se não chega nem log no Resend

O Resend só registra log quando **recebe** a requisição. A função agora grava logs no **Supabase** para você ver onde está parando:

1. **Faça deploy de novo** da função (para subir o código com os logs):
   ```bash
   npx supabase functions deploy send-email-verification-code --no-verify-jwt
   ```
2. No **Dashboard do Supabase**: **Edge Functions** → `send-email-verification-code` → aba **Logs**.
3. Peça um código de verificação de novo (cadastro no app) e olhe os logs. Você deve ver:
   - `[send-email-verification-code] requisição recebida` → a função foi chamada
   - `código salvo no banco para ...` → insert OK
   - `RESEND_API_KEY definida: true | FROM: ...` → secret carregada; se aparecer **false**, a key não está disponível
   - `Resend response status: 200` → Resend recebeu (aí deve aparecer no dashboard do Resend)

Se aparecer **RESEND_API_KEY definida: false**, os secrets não estão valendo para essa função. Confira no Dashboard: **Project Settings** → **Edge Functions** → **Secrets** (ou pelo CLI: `npx supabase secrets list` após `supabase link`). Os nomes devem ser exatamente `RESEND_API_KEY` e `RESEND_FROM_EMAIL`.

---

## 2. Recuperação de senha (link no e-mail)

Quem pede “Esqueci minha senha” recebe um e-mail do **Supabase Auth** com um link. Esse e-mail é enviado pelo próprio Supabase (não pelo Resend).

### O que pode estar errado

- **Redirect URL** não configurada no Supabase: o link do e-mail precisa abrir o app. Se o app usa o scheme `take-me-cliente`, o Supabase precisa autorizar esse redirect.
- **E-mails indo para spam**: os usuários devem verificar a pasta de spam.
- **Limite de envio** (plano gratuito do Supabase): há cota de e-mails por hora; muitos testes seguidos podem bloquear temporariamente.

### O que fazer

1. No **Supabase**: **Authentication** → **URL Configuration**.
2. Em **Redirect URLs**, adicione a URL que o app usa ao abrir pelo link de “recuperar senha”, por exemplo:
   - `take-me-cliente://reset-password`
   - Ou a URL completa que o Supabase monta (ex.: `take-me-cliente://reset-password#access_token=...`). Muitas vezes basta `take-me-cliente://**` para permitir qualquer path desse scheme.
3. No app, a variável `EXPO_PUBLIC_APP_SCHEME=take-me-cliente` já está no `.env` e nas variáveis do EAS (Preview), então o app envia esse redirect ao chamar `resetPasswordForEmail`.
4. Peça aos testadores para **verificarem a pasta de spam** ao pedir recuperação de senha.

---

## Resumo rápido

| Fluxo              | Quem envia      | O que checar                                                                 |
|--------------------|------------------|-------------------------------------------------------------------------------|
| Código cadastro    | Resend (Edge Fn) | `RESEND_API_KEY` e `RESEND_FROM_EMAIL` nos secrets do Supabase; domínio no Resend para enviar para qualquer e-mail. |
| Recuperar senha    | Supabase Auth    | Redirect URL em **Authentication** → **URL Configuration**; verificar spam.   |

Depois de ajustar, peça a alguém para testar de novo (cadastro e “esqueci minha senha”).
