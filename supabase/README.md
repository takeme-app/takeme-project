# Supabase – Take Me

## Cadastro e confirmação de e-mail (código 4 dígitos)

Para o cadastro e a tela de confirmar e-mail funcionarem, é preciso:

### 1. Rodar a migration

No projeto Supabase (Dashboard ou CLI), execute a migration que cria a tabela de códigos:

- **Pelo Dashboard:** SQL Editor → cole o conteúdo de `migrations/20250223000000_create_email_verification_codes.sql` → Run.
- **Pelo CLI:** na raiz do repositório, com o projeto linkado (`supabase link`), rode:
  ```bash
  supabase db push
  ```
  ou
  ```bash
  supabase migration up
  ```

### 2. Fazer deploy das Edge Functions

**Opção A – npm (recomendado, sem instalar CLI globalmente)**

Na raiz do repositório, instale as dependências e faça o link (uma vez): `npx supabase link` (informe o project ref). Depois:

```bash
npm run deploy:verify-email-code
```

Ou deploy das três funções de uma vez:

```bash
npm run deploy:functions
```

Os scripts usam `--no-verify-jwt` para evitar **401 Unauthorized**. O Supabase CLI fica como `devDependency` do projeto; use `npx supabase` para outros comandos.

**Opção B – CLI global no Windows (Scoop)**

Se preferir o binário global:

```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

Depois: `supabase link` e `supabase functions deploy verify-email-code --no-verify-jwt`.

**Opção C – Dashboard**

No [Dashboard](https://supabase.com/dashboard/project/xdxzxyzdgwpucwuaxvik/functions) → **Edge Functions** → selecione a função (ex.: `verify-email-code`) → **Editor** → cole o código de `supabase/functions/verify-email-code/index.ts` → **Deploy**. Em **Settings** da função, desative "Enforce JWT verification" para evitar 401.

Se quiser enviar os e-mails de verdade (código de verificação e e-mail de boas-vindas), defina os secrets:

```bash
supabase secrets set RESEND_API_KEY=sua_chave_resend
supabase secrets set RESEND_FROM_EMAIL=Take Me <noreply@seudominio.com>
```

As três funções usam o mesmo `RESEND_API_KEY` e `RESEND_FROM_EMAIL`. Sem `RESEND_API_KEY`, o código de verificação só aparece nos **logs** da função no Dashboard (útil para desenvolvimento), e o **e-mail de boas-vindas não é enviado** — só é registrado um log no Dashboard.

### 3. Confirmar e-mail no Supabase

No Dashboard do Supabase: **Authentication** → **Providers** → **Email** → em “Confirm email” você pode desativar a confirmação por link para usar só o fluxo do código de 4 dígitos (e a Edge Function `verify-email-code` quando estiver implementada).

---

**Erro "Edge Function returned a non-2xx status code"**

- A função `send-email-verification-code` ainda não foi implantada, ou
- A migration da tabela `email_verification_codes` não foi aplicada.

Siga os passos 1 e 2 acima.

---

## Erro "could not find the cpf column of profiles in the schema cache"

A tabela `profiles` é estendida pela migration `migrations/20250224000000_extend_profiles.sql`, que adiciona as colunas `cpf`, `city`, `state`, `rating` e `verified`. Se essa migration ainda não foi aplicada no seu projeto Supabase, o app pode dar esse erro ao editar CPF.

**Solução:** aplicar todas as migrations no projeto Supabase:

- **CLI (recomendado):** na raiz do repositório, com o projeto linkado (`npx supabase link`), rode:
  ```bash
  npx supabase db push
  ```
- **Dashboard:** em **SQL Editor**, execute o conteúdo de `migrations/20250224000000_extend_profiles.sql`.

---

## Cadastro de dependentes (documentos)

O cadastro de dependentes usa a tabela `dependents` e o bucket de storage **dependent-documents** para guardar documento do dependente e do responsável (PDF ou imagem).

### Banco e storage

- A tabela `dependents` é criada em `migrations/20250224000001_create_dependents.sql` (campos: `document_url`, `representative_document_url` guardam o **caminho** do arquivo no bucket).
- O bucket **dependent-documents** (privado) é criado em `migrations/20250224000006_create_dependent_documents_bucket.sql`.
- As políticas de storage (upload, leitura, update, delete) estão em `20250224000004_storage_buckets.sql` e `20250224000007_dependent_docs_storage_update_policy.sql`.

Para aplicar tudo (se ainda não rodou):

```bash
npx supabase db push
```

No app, o fluxo é: cadastrar dependente → opcionalmente anexar os dois documentos → upload para `dependent-documents/{user_id}/{dependent_id}/...` → atualização da linha do dependente com os caminhos. Na tela de detalhes do dependente, os documentos são abertos via **signed URL** (bucket privado). Ao excluir um dependente, os arquivos desse dependente no bucket também são removidos.
