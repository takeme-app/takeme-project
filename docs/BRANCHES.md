# Estratégia de branches — Take Me

Este documento descreve como usar branches no monorepo para trabalhar em paralelo: **admin (web)**, **cliente**, **motorista**, **preparador-encomendas** e **preparador-excursoes**, com vários devs.

**Separação dos apps:** Cada app pode ser rodado de forma independente. O **admin** tem seu próprio `metro.config.js` em `apps/admin/` — rode sempre a partir de `apps/admin` (`npm run start`) para não abrir outro app. O motorista/cliente usam o Metro da raiz (ou o config do próprio app, se existir). Veja `apps/admin/README.md` para fluxo só do admin.

---

## Branches principais

| Branch    | Uso |
|----------|-----|
| **main** | Código em produção. Só entra via merge de PR revisado. Estável. |
| **develop** | (Opcional) Integração diária. Feature branches podem fazer merge aqui antes de ir para `main`. |

Recomendação: usar **main** como referência e criar **feature branches** por app ou funcionalidade. Se a equipe preferir, criem **develop** e façam PRs para `develop` primeiro e depois `develop` → `main` para releases.

---

## Nomeação de branches

Use prefixos por **app** ou **escopo** para evitar conflito entre times:

| Prefixo | Quem usa | Exemplos |
|--------|----------|----------|
| `admin/` | Dev(s) do painel web | `admin/login`, `admin/dashboard-viagens`, `admin/fix-sessao` |
| `cliente/` | Dev(s) do app cliente (mobile) | `cliente/pagamentos`, `cliente/recuperar-senha` |
| `motorista/` | Dev(s) do app motorista | `motorista/rotas`, `motorista/aceitar-corrida` |
| `preparador-encomendas/` | Dev(s) do app preparador encomendas | `preparador-encomendas/lista-pedidos` |
| `preparador-excursoes/` | Dev(s) do app preparador excursões | `preparador-excursoes/budget` |
| `shared/` ou `packages/` | Alterações em `packages/shared` (afeta todos) | `shared/tipos-booking`, `packages/supabase-client` |
| `supabase/` | Migrations, Edge Functions, config | `supabase/fn-delete-account`, `supabase/migration-livros` |

Formato sugerido: **`<escopo>/<descricao-curta>`** (minúsculo, hífen para espaços).

---

## Fluxo de trabalho (resumo)

1. **Sempre partir de `main` atualizado**
   ```bash
   git checkout main
   git pull origin main
   ```

2. **Criar sua branch de trabalho**
   ```bash
   # Ex.: você no admin
   git checkout -b admin/sua-feature
   ```

3. **Trabalhar e commitar**
   - Commits pequenos e descritivos.
   - Evite alterar vários apps na mesma branch (principalmente `packages/shared` + vários apps).

4. **Manter a branch atualizada com `main`**
   ```bash
   git fetch origin
   git merge origin/main
   # ou: git rebase origin/main
   ```

5. **Enviar e abrir PR**
   ```bash
   git push -u origin admin/sua-feature
   ```
   No GitHub: **Compare & pull request** de `admin/sua-feature` → `main` (ou → `develop`).

6. **Revisão e merge**
   - Outro dev revisa (ou você, se for 1 pessoa).
   - Merge na base (main/develop). Deletar a branch após o merge (opcional).

---

## Exemplo: você no Admin, outros no mobile

- **Você:**  
  `main` → `admin/painel-viagens` → commits só em `apps/admin/` (e talvez `packages/shared` se precisar).  
  PR `admin/painel-viagens` → `main`.

- **Outro dev (cliente):**  
  `main` → `cliente/nova-tela-pagamento` → commits em `apps/cliente/`.  
  PR `cliente/nova-tela-pagamento` → `main`.

Conflitos tendem a ser raros se cada um mexe no próprio app; conflitos aparecem mais em `packages/shared`, `package.json` da raiz e arquivos de config compartilhados. Por isso: atualizar sempre com `main` e fazer PRs menores.

---

## Dicas

- **Rebase vs merge:**  
  - `git merge origin/main` na sua branch: histórico com merges explícitos.  
  - `git rebase origin/main`: histórico linear; evite rebase em branch já compartilhada.

- **Sincronizar com main:**  
  Faça isso pelo menos antes de abrir o PR e quando `main` tiver mudado (ex.: outro app mergeado).

- **Builds e CI:**  
  Se no futuro houver GitHub Actions, configure para rodar por app (ex.: só `apps/admin` quando mudar em `apps/admin/`), para cada PR.

---

## Criar a branch inicial (admin)

Para começar a trabalhar no admin a partir de hoje:

```bash
git checkout main
git pull origin main
git checkout -b admin/setup
# trabalhe... depois:
git add .
git commit -m "feat(admin): descrição"
git push -u origin admin/setup
```

Substitua `admin/setup` por um nome que descreva sua primeira tarefa (ex.: `admin/login`, `admin/dashboard`).
