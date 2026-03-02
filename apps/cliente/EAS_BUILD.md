# Build EAS – Take Me Cliente

## Antes de subir qualquer build (evitar problemas de keys)

O build na nuvem **não usa** o arquivo `.env` do seu computador. Todas as variáveis precisam estar configuradas no **Expo** para o ambiente do perfil (preview ou production). Se alguma faltar, o app pode mostrar "Mapa indisponível", "Supabase não configurado" ou falhas de login/pagamento.

### 1. Variáveis obrigatórias para Preview (entrega e testes)

Configure no painel do Expo **ou** via CLI para o ambiente **Preview**:

| Variável | Uso | Onde pegar |
|----------|-----|------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Backend / auth | Supabase → Project Settings → API |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Backend / auth | Mesmo lugar |
| `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` | Mapas | [Mapbox Access Tokens](https://account.mapbox.com/access-tokens/) |
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Pagamentos (tokenização) | Stripe Dashboard → API Keys (chave pública) |

### 2. Variáveis opcionais

| Variável | Uso | Valor sugerido |
|----------|-----|----------------|
| `EXPO_PUBLIC_APP_SCHEME` | Deep link (ex.: recuperar senha) | `take-me-cliente` |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps (se usar no futuro) | Pode ficar vazio |

### 3. Onde configurar no Expo

1. Acesse [expo.dev](https://expo.dev) → organização **fraktal-softwares** → projeto **Take Me - Cliente**.
2. Vá em **Environment variables** (ou **Secrets**).
3. Crie cada variável e associe ao ambiente **Preview** (e **Production** quando for build de loja).
4. Use os **mesmos valores** que estão no `.env` na raiz do repositório (Supabase, Mapbox, Stripe).

### 4. Configurar via CLI (uma vez)

Na pasta do app, com os valores reais do seu projeto:

```bash
cd apps/cliente

# Obrigatórias (use os valores do seu .env)
eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://SEU_PROJECT.supabase.co" --environment preview --visibility plaintext
eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." --environment preview --visibility secret
eas env:create --name EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN --value "pk.eyJ1Ijoi..." --environment preview --visibility secret
eas env:create --name EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY --value "pk_test_..." --environment preview --visibility plaintext

# Opcional (deep link)
eas env:create --name EXPO_PUBLIC_APP_SCHEME --value "take-me-cliente" --environment preview --visibility plaintext
```

Para **production**, repita os comandos trocando `--environment production` (e use as chaves de produção se forem diferentes).

### 5. Conferir antes de buildar

- No painel do Expo: **Project → Environment variables** → ambiente **Preview** deve listar as quatro variáveis obrigatórias.
- Ou rode `eas env:list --environment preview` na pasta `apps/cliente` para listar.

---

## Gerar APK para preview (entrega / testes / logo atualizado)

Um único build de **preview** serve para:
- enviar para outras pessoas testarem (entrega),
- atualizar o ícone/logo no seu app.

```bash
cd apps/cliente
eas build -p android --profile preview
```

Ao terminar, baixe o APK pelo link do EAS, instale no celular ou envie o link de download para os testadores.

---

## Gerar AAB para produção (Play Store)

Quando for publicar na loja:

```bash
cd apps/cliente
eas build -p android --profile production
```

Certifique-se de que as variáveis de ambiente estão configuradas para o ambiente **Production** no Expo (mesmas chaves ou chaves de produção).

---

## Subir no TestFlight (iOS)

Você precisa de **conta Apple Developer** (paga) e do app criado no **App Store Connect**.

### 1. Criar o app no App Store Connect (uma vez)

1. [App Store Connect](https://appstoreconnect.apple.com) → **Apps** → **+** → **Novo app**.
2. **Bundle ID:** use **`com.takeme.cliente`** (igual ao `app.json`).
3. Anote o **Apple ID** do app.

### 2. Build e submit

```bash
cd apps/cliente
eas build -p ios --profile preview
# quando terminar:
eas submit --platform ios --latest
```

Siga as perguntas (credenciais Apple, build mais recente). No **App Store Connect → TestFlight**, adicione testadores e compartilhe o link.

---

## Resumo rápido

| Objetivo | Comando |
|----------|---------|
| APK para testar / entregar / logo novo | `eas build -p android --profile preview` |
| AAB para Play Store | `eas build -p android --profile production` |
| iOS TestFlight | `eas build -p ios --profile preview` → `eas submit --platform ios --latest` |

**Importante:** antes do primeiro build (e se mudar de máquina ou de projeto), confira as variáveis de ambiente no Expo para o perfil que você está usando (preview ou production).
