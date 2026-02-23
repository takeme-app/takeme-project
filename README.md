# Take Me

Monorepo do Take Me — app tipo Uber com 5 ambientes: Cliente, Motorista, Preparador de Encomendas, Preparador de Excursões e Admin (web).

- **Repositório:** [github.com/FraktalSoftwares/take_me](https://github.com/FraktalSoftwares/take_me)
- **Supabase (projeto):** [Dashboard](https://supabase.com/dashboard/project/xdxzxyzdgwpucwuaxvik) — ID do projeto: `xdxzxyzdgwpucwuaxvik`

## Estrutura

- **apps/cliente** — Ambiente Cliente (Expo, mobile)
- **apps/motorista** — Ambiente Motorista (Expo, mobile)
- **apps/preparador-encomendas** — Preparador de Encomendas (Expo, mobile)
- **apps/preparador-excursoes** — Preparador de Excursões (Expo, mobile)
- **apps/admin** — Ambiente Administrativo (Expo Web, desktop)
- **packages/shared** — Tipos, cliente Supabase e utilitários compartilhados

## Pré-requisitos

- Node.js >= 18
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
     - **Google Maps:** [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → API key (para Android/iOS).

   Não coloque `SUPABASE_SERVICE_ROLE_KEY` em nenhum app; use apenas em Edge Functions ou backends privados.

## Rodar os apps

Na raiz:

```bash
# Mobile (Expo Go)
npm run cliente
npm run motorista
npm run preparador-encomendas
npm run preparador-excursoes

# Admin (web)
npm run admin
```

Ou entre na pasta do app e rode `npm run start` (ou `npx expo start`).

## MCP

- **Supabase:** use o MCP user-supabase para migrations, SQL, tipos (`generate_typescript_types`) e Edge Functions. Configure o MCP para o projeto **xdxzxyzdgwpucwuaxvik** ([dashboard](https://supabase.com/dashboard/project/xdxzxyzdgwpucwuaxvik)).
- **Figma:** adicione o MCP do Figma nas configurações do Cursor quando quiser alinhar UI aos designs.
