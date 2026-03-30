# Checklist matriz QA — Admin Take Me

Marque **OK** / **Falha** / **N/A** por linha. Confrontar contagens com [scripts/admin-qa/reconcile.sql](scripts/admin-qa/reconcile.sql) e [docs/admin-qa-sql-verification.md](docs/admin-qa-sql-verification.md). Ordem de execução: [docs/admin-qa-runbook.md](docs/admin-qa-runbook.md). Ambiente: [docs/admin-qa-environment.md](docs/admin-qa-environment.md). Bugs: [docs/admin-qa-bugs.md](docs/admin-qa-bugs.md).

## Resumo por módulo

| Módulo | Carregar | Dados vs SQL | Filtros | Navegação / IDs | Escritas (staging) |
|--------|----------|--------------|---------|-----------------|-------------------|
| Auth / login | | | | | |
| Início (Home) | | | Ver subsecção | | N/A |
| Viagens | | | Ver subsecção | `bookingId` | Cancelar / pago |
| Passageiros | | | Ver subsecção | `id` + booking | |
| Motoristas | | | Ver subsecção | `tripId` | |
| Destinos | | | Ver subsecção | | |
| Encomendas | | | Ver subsecção | | |
| Preparadores | | | Ver subsecção | | |
| Promoções | | | Ver subsecção | | Edge manage-promotions |
| Pagamentos / gestão | | | Ver subsecção | | |
| Atendimentos | | | Ver subsecção | | |
| Configurações | | | Ver subsecção | | |

---

## Auth (`/login`, `/signup`, `/forgot-password`)

| # | Funcionalidade / filtro | OK/Falha/N/A |
|---|-------------------------|--------------|
| A1 | Login e-mail + senha válidos → redireciona | |
| A2 | Credenciais inválidas → mensagem de erro | |
| A3 | Campos vazios → validação | |
| A4 | Supabase não configurado → mensagem explícita | |
| A5 | Signup / forgot-password carregam e formulário submete sem crash | |

## Layout

| # | Funcionalidade | OK/Falha/N/A |
|---|----------------|--------------|
| L1 | Tabs principais navegam para a rota certa | |
| L2 | Menu “Mais” (viewport estreito) lista rotas ocultas | |
| L3 | Conta / sair | |

## Início `/`

| # | Controlo | OK/Falha/N/A |
|---|----------|--------------|
| H1 | Sub-tab Viagens / Encomendas altera cartões | |
| H2 | Campo Buscar (se aplicável ao estado atual) | |
| H3 | Dropdown Take Me / Motorista parceiro | |
| H4 | Botão Filtro → modal: datas início/fim | |
| H5 | Modal: “Datas incluídas” (rádios) | |
| H6 | Modal: chips status viagem | |
| H7 | Modal: chips categoria | |
| H8 | “Aplicar filtro” → cartões batem com lista filtrada (viagens/encomendas) | |
| H9 | Gráfico de payouts (copy global vs filtrado conforme UI) | |

## Viagens `/viagens`

| # | Controlo | OK/Falha/N/A |
|---|----------|--------------|
| V1 | Buscar (barra) | |
| V2 | Trocar motorista (painel) | |
| V3 | Filtro barra: datas, datas incluídas, status, categoria | |
| V4 | Filtro tabela: nome motorista, origem, data, status, categoria | |
| V5 | Linha → detalhe URL = `bookingId` correto | |
| V6 | Editar / histórico / confirmar pagamento / cancelar | |
| V7 | Mapa (Google) com `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | |

## Passageiros `/passageiros`

| # | Controlo | OK/Falha/N/A |
|---|----------|--------------|
| P1 | Buscar | |
| P2 | Trocar motorista | |
| P3 | Filtro página: datas, datas incluídas, status, faixa etária, género | |
| P4 | Filtro tabela: nome, origem, data, categoria | |
| P5 | Visualizar / Editar → booking ou detalhe coerente | |

## Motoristas `/motoristas`

| # | Controlo | OK/Falha/N/A |
|---|----------|--------------|
| M1 | Busca / filtros de página e de tabela (conforme UI) | |
| M2 | Navegação viagem → `tripId` na URL | |
| M3 | Editar motorista | |

## Destinos `/destinos`

| # | Controlo | OK/Falha/N/A |
|---|----------|--------------|
| D1 | Busca texto | |
| D2 | Dropdown estado (UF) | |
| D3 | Filtro página: datas texto, datas incluídas (rádio), status, categoria | |
| D4 | Filtro tabela: origem, destino, horas (N/A dados), data inicial (`YYYY-MM-DD` ou substring em data exibida), status, categoria | |
| D5 | KPI “Total” e gráfico refletem lista filtrada | |
| D6 | Nova rota / visualizar / editar | |

## Encomendas `/encomendas`

| # | Controlo | OK/Falha/N/A |
|---|----------|--------------|
| E1 | Filtro página: datas, datas incluídas, status, categoria | |
| E2 | Filtro tabela (campos do modal) | |
| E3 | Editar / viagem partilhada | |

## Preparadores `/preparadores`

| # | Controlo | OK/Falha/N/A |
|---|----------|--------------|
| PR1 | Tab encomendas / excursões | |
| PR2 | Busca | |
| PR3 | Filtro página (modal) | |
| PR4 | Filtro tabela (modal) | |
| PR5 | Editar / viagem | |

## Promoções `/promocoes`, `/promocoes/nova`

| # | Controlo | OK/Falha/N/A |
|---|----------|--------------|
| PRM1 | Filtros / listagem | |
| PRM2 | Criar promoção + Edge `manage-promotions` | |

## Pagamentos

| # | Rota / controlo | OK/Falha/N/A |
|---|-----------------|--------------|
| PG1 | `/pagamentos` | |
| PG2 | `/pagamentos/gestao` + filtros | |
| PG3 | `/pagamentos/gestao/criar-trecho` | |
| PG4 | Detalhe preparador-encomendas `:slug` | |
| PG5 | Detalhe motorista `:slug` | |

## Atendimentos

| # | Controlo | OK/Falha/N/A |
|---|----------|--------------|
| AT1 | `/atendimentos` listas e filtros | |
| AT2 | `/atendimentos/:id` | |
| AT3 | `/atendimentos/:id/orcamento` | |

## Configurações `/configuracoes`

| # | Controlo | OK/Falha/N/A |
|---|----------|--------------|
| C1 | Secções / permissões / gravação | |

---

**Mapas:** com `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`, validar trajeto em tempo real nos ecrãs que usam mapa.
