# Reset de senha por e-mail ou telefone

Este documento resume a atualização que permite redefinir senha usando o mesmo padrão de identificação do login/cadastro: **e-mail ou telefone** em um campo único.

## Objetivo

Antes, o fluxo de recuperação de senha funcionava apenas por e-mail. Isso não atendia contas criadas por telefone, porque essas contas são armazenadas no Supabase Auth com um e-mail técnico no formato:

```text
{telefone_somente_digitos}@takeme.com
```

O usuário, porém, conhece e usa o telefone como identidade. A atualização permite que ele digite o telefone, receba um código de 4 dígitos e defina uma nova senha usando as mesmas telas já existentes de OTP e reset.

## Fluxo atual

1. Usuário abre **Esqueci minha senha**.
2. Digita **e-mail ou telefone**.
3. O app detecta o canal:
   - e-mail: usa `send-email-verification-code`;
   - telefone: usa `send-phone-verification-code`.
4. O usuário informa o código de 4 dígitos na mesma tela `ForgotPasswordVerifyCodeScreen`.
5. A tela verifica o código:
   - e-mail: `verify-email-code`;
   - telefone: `verify-phone-code`.
6. A Edge Function devolve `password_reset_token`.
7. A tela `ResetPasswordScreen` chama `complete-password-reset`.
8. `complete-password-reset` valida o token e atualiza a senha via `auth.admin.updateUserById`.

## Alterações no app Cliente

Arquivos principais:

- `apps/cliente/src/screens/ForgotPasswordScreen.tsx`
- `apps/cliente/src/screens/ForgotPasswordVerifyCodeScreen.tsx`
- `apps/cliente/src/navigation/types.ts`

Mudanças:

- Campo de recuperação passou de **e-mail** para **e-mail ou telefone**.
- Reaproveita `detectPhoneOrEmailChannel` e `formatPhoneBRMask`.
- Para telefone, envia apenas dígitos BR (10 ou 11 dígitos) para as Edge Functions.
- `ForgotPasswordVerifyCode` agora aceita `{ email?: string; phone?: string }`.
- A tela OTP adapta textos para **Código no e-mail** ou **Código no WhatsApp**.

## Alterações no app Motorista

Arquivos principais:

- `apps/motorista/src/screens/ForgotPasswordScreen.tsx`
- `apps/motorista/src/screens/ForgotPasswordVerifyCodeScreen.tsx`
- `apps/motorista/src/navigation/types.ts`
- `apps/motorista/src/utils/phoneOrEmailInput.ts`

Mudanças:

- Mesmo comportamento do Cliente: identificador unificado e reaproveitamento das telas.
- Foi criado helper local `phoneOrEmailInput.ts`, equivalente ao do Cliente, para máscara e detecção de canal.

## Alterações nas Edge Functions

### `_shared/passwordResetToken.ts`

Novo helper compartilhado:

- `createPasswordResetToken(userId, identifier)`
- `findAuthUserIdByPhone(admin, phoneDigits)`
- `getPasswordResetSecret()`

Centraliza a criação do token HMAC usado pelo fluxo de reset.

### `send-phone-verification-code`

Agora, quando `purpose = "password_reset"`:

- normaliza telefone;
- verifica se existe conta em `profiles.phone`;
- aceita variação com DDI `55` quando aplicável;
- se não encontrar, retorna mensagem clara:

```text
Não encontramos uma conta com este telefone. Verifique o número ou cadastre-se.
```

Para `purpose = "signup"`, mantém o comportamento anterior: se o telefone já existe, bloqueia o cadastro.

### `verify-phone-code`

Agora suporta dois modos:

- `signup`: comportamento antigo, cria usuário Auth com e-mail fake `{phone}@takeme.com`;
- `password_reset`: valida OTP em `phone_verification_codes`, localiza o usuário por `profiles.phone`, gera `password_reset_token` e não cria conta.

### `verify-email-code`

Foi simplificada para usar o helper compartilhado `createPasswordResetToken`.

### `complete-password-reset`

Foi ajustada para aceitar tokens novos com campo `identifier` e tokens antigos com campo `email`, mantendo compatibilidade.

## Banco de dados

Não foi necessária nova migration para a tabela de telefone, porque `phone_verification_codes` já possuía:

```sql
purpose text not null default 'signup'
check (purpose in ('signup', 'password_reset'))
```

Ou seja, a base já aceitava códigos de telefone para redefinição de senha.

## Segurança e operação

- O token de reset tem validade curta (15 minutos).
- O OTP de telefone continua com validade de 10 minutos.
- A senha só é alterada por `complete-password-reset`, usando service role no backend.
- Para produção, é obrigatório integrar o envio real do WhatsApp/SMS. Hoje `send-phone-verification-code` ainda está em stub:
  - em dev, retorna `dev_code`;
  - em prod, grava o código e retorna `ok`, mas ainda não envia mensagem real.

## Impacto de produto

Com esta atualização:

- usuários cadastrados por e-mail continuam recuperando senha por e-mail;
- usuários cadastrados por telefone recuperam senha digitando o telefone;
- Cliente e Motorista usam o mesmo padrão visual e funcional;
- não é necessário expor nem pedir o e-mail fake `{telefone}@takeme.com` ao usuário.

## Pontos futuros recomendados

- Integrar a Meta WhatsApp Cloud API em `send-phone-verification-code`.
- Mover também a validação do token de `complete-password-reset` para `_shared/passwordResetToken.ts`, deixando criação e verificação 100% centralizadas.
- Criar testes manuais de QA para os quatro caminhos:
  - Cliente + e-mail;
  - Cliente + telefone;
  - Motorista + e-mail;
  - Motorista + telefone.

