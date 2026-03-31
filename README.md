# Take Me

Monorepo do Take Me — app tipo Uber com 3 apps: Cliente, Motorista e Admin (web). O cadastro de preparadores (encomendas e excursões) permanece no fluxo do app motorista.

- **Repositório:** [github.com/FraktalSoftwares/take_me](https://github.com/FraktalSoftwares/take_me)
- **Supabase (projeto):** [Dashboard](https://supabase.com/dashboard/project/xdxzxyzdgwpucwuaxvik) — ID do projeto: `xdxzxyzdgwpucwuaxvik`

## Para novos desenvolvedores

O **Take Me** é uma plataforma de mobilidade e serviços que conecta passageiros, motoristas e preparadores: agendamento de viagens (rotas regulares), envio de encomendas, envio de dependentes e solicitação de excursões. O monorepo reúne o app do **cliente** (passageiro), o app do **motorista** (incluindo cadastro como preparador de encomendas ou excursões) e o **admin** (painel web). Backend e autenticação ficam no **Supabase**. Se você está entrando no projeto, leia o [relatório de situação atual](docs/ESTADO_DO_PROJETO.md) para visão geral, stack, configuração local e estado do Supabase.

## Branches e trabalho em equipe

Vários devs podem trabalhar em paralelo (admin, cliente, motorista, etc.). Veja **[docs/BRANCHES.md](docs/BRANCHES.md)** para estratégia de branches, prefixos por app (`admin/`, `cliente/`, `motorista/`, …) e fluxo de PR para `main`.

## Estrutura

- **apps/cliente** — Ambiente Cliente (Expo, mobile)
- **apps/motorista** — Ambiente Motorista (Expo, mobile)
- **apps/admin** — Ambiente Administrativo (Expo Web, desktop)
- **packages/shared** — Tipos, cliente Supabase e utilitários compartilhados

## Pré-requisitos

- Node.js >= 18 (recomendado **Node 20.x** para Expo 54)
- npm (ou pnpm)
- [Expo Go](https://expo.dev/go) no celular (para testar os apps mobile)

## Configuração

1. **Instalar dependências** (na raiz do repositório):

   ```bash
   npm install
   ```

   Ou com pnpm (se tiver `pnpm-workspace.yaml` e pnpm instalado):

   ```bash
   pnpm install
   ```

   Se aparecer erro `EPERM` ou "operation not permitted", rode `npm install` de novo ou feche editores/OneDrive na pasta; em último caso, execute o terminal como administrador.

2. **Variáveis de ambiente**

   - Copie `.env.example` para `.env` na raiz (e/ou em cada app, se quiser valores por app).
   - Preencha com os valores do seu projeto:
     - **Supabase:** [Settings API deste projeto](https://supabase.com/dashboard/project/xdxzxyzdgwpucwuaxvik/settings/api) → URL e anon key.
     - **Mapbox:** [Mapbox Access Tokens](https://account.mapbox.com/access-tokens/) → token público.
     - **Stripe:** [Stripe Dashboard → API Keys](https://dashboard.stripe.com/apikeys) → chave pública (publishable key).
     - **Google Maps:** [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → API key (opcional).

   Não coloque `SUPABASE_SERVICE_ROLE_KEY` em nenhum app; use apenas em Edge Functions ou backends privados.

3. **Storage (foto de perfil)**  
   O app cliente envia a foto de perfil para o bucket **avatars**. Para criar o bucket automaticamente, na raiz do projeto adicione no `.env` a **SUPABASE_SERVICE_ROLE_KEY** (Dashboard > Settings > API > service_role) e rode:

   ```bash
   npm run create-avatars-bucket
   ```

   Se preferir criar manualmente: [Storage](https://supabase.com/dashboard/project/xdxzxyzdgwpucwuaxvik/storage/buckets) → **New bucket** → id: `avatars`, marque como **Public**.

## Rodar os apps

Na raiz:

```bash
# Mobile (Expo Go)
npm run cliente
npm run motorista

# Admin (web)
npm run admin
```

Ou entre na pasta do app e rode `npm run start` (ou `npx expo start`).

## Deploy Admin (Vercel)

O admin é exportado com `expo export --platform web` e o build é configurado pelo `vercel.json` na raiz (Root Directory = `apps/admin`, install na raiz do repo, output = `dist`).

**Variáveis de ambiente na Vercel:** em Project Settings → Environment Variables, defina (para o build inliner do Expo):

- `EXPO_PUBLIC_SUPABASE_URL` — URL do projeto Supabase
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — anon key do Supabase

Sem essas variáveis no deploy, o app pode abrir em tela branca ou falhar ao carregar a sessão.

## Exclusão de conta (app cliente)

No app cliente, o usuário pode excluir a própria conta pelo **Perfil → Excluir conta**. O fluxo é em duas etapas:

1. **Step 1:** confirmação de intenção (“Tem certeza?”) com opções “Manter conta” e “Continuar para exclusão”.
2. **Step 2:** o usuário digita **EXCLUIR** em um campo e toca em “Excluir minha conta”. O app chama a Edge Function `delete-account` com `body: { confirm: "EXCLUIR" }`.

A Edge Function `delete-account` (Supabase):

- Valida o token e exige `confirm === "EXCLUIR"`.
- Lê `stripe_customer_id` do perfil (antes de qualquer exclusão).
- **Storage:** remove todos os objetos do usuário nos buckets `avatars`, `dependent-documents`, `shipment-photos` e `excursion-passenger-docs` (prefixo `{user_id}/`).
- **Stripe:** se existir `stripe_customer_id`, chama a API Stripe para deletar o customer (requer `STRIPE_SECRET_KEY` nas variáveis da função).
- **Auth:** chama `admin.auth.admin.deleteUser(user.id)`. O banco remove em cascade: `profiles`, `dependents`, `bookings`, `user_preferences`, `notifications`, `notification_preferences`, `recent_destinations`, `shipments`, `dependent_shipments`, `payment_methods`, `data_export_requests`, `excursion_requests`, etc.

Em sucesso (resposta `{ ok: true }`), o app faz signOut e redireciona para a tela Splash. Em erro, exibe mensagem amigável e o usuário permanece na Step 2.

## Build Android (APK/AAB)

### EAS Build (nuvem)

Sempre rode o EAS a partir da **pasta do app**:

```bash
cd apps/cliente
eas build --platform android --profile preview
```

(Use `production` para AAB na Play Store.) Garanta que o branch/commit que o EAS usa tenha o `apps/cliente/android/settings.gradle` correto (bloco `pluginManagement {` como primeira linha). Após alterações em `android/`, faça commit e push antes de disparar o build.

### Build local (APK no PC)

Requisitos: **Java (JDK)** e **Android SDK** (por exemplo via [Android Studio](https://developer.android.com/studio)).

1. Defina `JAVA_HOME` (ex.: `C:\Program Files\Android\Android Studio\jbr` no Windows).
2. Crie `apps/cliente/android/local.properties` com o caminho do SDK, por exemplo:
   `sdk.dir=C\:\\Users\\SEU_USUARIO\\AppData\\Local\\Android\\Sdk`
3. Na pasta do app cliente, use o **script automatizado** (recomendado):

   ```bash
   cd apps/cliente
   npm run android:release
   ```

   O script faz bump automático da versão (patch), builda via Gradle e renomeia o APK para `take-me-cliente-{versão}.apk`. Para **manter a versão atual** sem bump:

   ```bash
   # PowerShell
   $env:SKIP_VERSION_BUMP="1"; npm run android:release

   # Bash
   SKIP_VERSION_BUMP=1 npm run android:release
   ```

   O APK fica em `apps/cliente/android/app/build/outputs/apk/release/take-me-cliente-{versão}.apk`.

   **Alternativa manual** (Gradle direto):

   ```bash
   cd apps/cliente/android
   ./gradlew assembleRelease
   ```

   Nesse caso o APK fica como `app-release.apk` no mesmo diretório.

### Prebuild

Se rodar `expo prebuild --clean`, a pasta `android/` será regenerada. O template do Expo pode gerar um `settings.gradle` que quebra no Gradle 8.14 (linha antes de `pluginManagement`). Nesse caso, edite `apps/cliente/android/settings.gradle` e mova a linha `def projectRoot = settings.settingsDir.parentFile` para **dentro** do bloco `pluginManagement { }` (como primeira linha do bloco).

## MCP

- **Supabase:** use o MCP user-supabase para migrations, SQL, tipos (`generate_typescript_types`) e Edge Functions. Configure o MCP para o projeto **xdxzxyzdgwpucwuaxvik** ([dashboard](https://supabase.com/dashboard/project/xdxzxyzdgwpucwuaxvik)).
- **Figma (local):** use o **Figma Desktop MCP Server** para alinhar UI aos designs.
  1. Abra o **Figma Desktop** (não o navegador), vá em **Preferences** e ative **Dev Mode MCP Server**.
  2. O servidor sobe em `http://127.0.0.1:3845/mcp`.
  3. No Cursor: **Settings → Cursor Settings → MCP** → "Add new global MCP server" e adicione:
     ```json
     "figma-desktop": {
       "url": "http://127.0.0.1:3845/mcp"
     }
     ```
  4. Requer Figma Desktop atualizado e assinatura Dev/Full (Professional/Organization/Enterprise). Depois de conectar, você pode usar contexto de design, gerar código a partir de frames e Code Connect.
