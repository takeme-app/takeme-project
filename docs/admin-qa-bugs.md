# Registo de bugs / correções (QA Admin)

## Corrigido neste pass

| ID | Prioridade | Módulo | Descrição |
|----|------------|--------|-----------|
| QA-DEST-01 | P1 | Destinos | Filtros da barra, dropdown de estado, modal da página e modal da tabela não aplicavam-se à lista nem aos KPIs/gráfico. **Correção:** agregação em [apps/admin/src/data/queries.ts](apps/admin/src/data/queries.ts) (`fetchDestinos`) com contagens por estado de viagem, Take Me vs parceiro, e flags de partida passada/futura; filtro client-side em [apps/admin/src/screens/DestinosScreen.tsx](apps/admin/src/screens/DestinosScreen.tsx). |

## Campos de filtro ainda limitados (documentar no teste manual)

| Módulo | Controlo | Nota |
|--------|----------|------|
| Destinos | Hora embarque / hora chegada (modal tabela) | Sem dados por rota agregada; não filtram. |
| Destinos | Datas texto livres no modal da página (`Data inicial/final`) | Não ligadas a critério SQL; preferir `YYYY-MM-DD` no campo “Data inicial” da **tabela** para filtro por `primeiraDataIso`. |

## Abertos / a monitorizar

- Preencher aqui com bugs encontrados na execução do [docs/admin-qa-runbook.md](docs/admin-qa-runbook.md) (passos de reprodução em 2–3 linhas).
