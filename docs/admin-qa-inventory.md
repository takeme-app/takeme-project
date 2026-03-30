# Inventário Admin — rotas, dados e risco (Fase 0)

Projeto Supabase: `xdxzxyzdgwpucwuaxvik`. Dados QA: prefixo `[QA-TEST]`; ver `scripts/admin-qa/reconcile.sql`.

Legenda: **R** = leitura predominante, **W** = escrita / ações de negócio.

| Rota | Ecrã | Fontes principais | R/W |
|------|------|-------------------|-----|
| `/login` | WebLoginScreen | Supabase Auth | W |
| `/signup` | WebSignupScreen | Supabase Auth | W |
| `/forgot-password` | WebForgotPasswordScreen | Auth recovery | W |
| `/` | HomeScreen | fetchHomeCounts, fetchPagamentoCounts, fetchViagens/fetchEncomendas (filtros) | R |
| `/viagens` | ViagensScreen | fetchViagens, fetchViagemCounts, updateBookingStatus | R/W |
| `/viagens/:id` | ViagemDetalheScreen | queries viagem/detalhe | R |
| `/viagens/:id/historico` | HistoricoViagensScreen | histórico | R |
| `/viagens/:id/editar` | ViagemEditScreen | edição | R/W |
| `/passageiros` | PassageirosScreen | fetchPassageiros, counts | R |
| `/passageiros/:id` | PassageiroDetalheScreen | detalhe passageiro | R |
| `/passageiros/:pid/viagem/:id` | ViagemDetalheScreen | — | R |
| `/passageiros/:pid/viagem/:id/editar` | ViagemEditScreen | — | R/W |
| `/motoristas` | MotoristasScreen | fetchMotoristas, viagens | R |
| `/motoristas/:mid/viagem/:id` | ViagemDetalheScreen | — | R |
| `/motoristas/:mid/viagem/:id/historico` | HistoricoViagensScreen | — | R |
| `/motoristas/:id/editar` | MotoristaEditScreen | worker update | R/W |
| `/destinos` | DestinosScreen | fetchDestinos | R |
| `/encomendas` | EncomendasScreen | fetchEncomendas | R |
| `/encomendas/:id/editar` | EncomendaEditScreen | edição encomenda | R/W |
| `/encomendas/:eid/viagem/:id` | ViagemDetalheScreen | — | R |
| `/preparadores` | PreparadoresScreen | fetchPreparadores | R |
| `/preparadores/:id/editar` | PreparadorEditScreen | update preparador | R/W |
| `/preparadores/:pid/viagem/:id` | ViagemDetalheScreen | — | R |
| `/promocoes` | PromocoesScreen | fetchPromocoes, manage-promotions | R/W |
| `/promocoes/nova` | PromocaoCreateScreen | manage-promotions POST | W |
| `/pagamentos` | PagamentosScreen | payouts / counts | R |
| `/pagamentos/gestao` | PagamentosGestaoScreen | pricing routes, motoristas, bases, Edge | R/W |
| `/pagamentos/gestao/criar-trecho` | PagamentoCriarTrechoScreen | manage-pricing-routes | W |
| `/pagamentos/gestao/preparador-encomendas/:slug` | PagamentoPreparadorEncomendaDetailScreen | mix mock + dados | R |
| `/pagamentos/gestao/motorista/:slug` | PagamentoMotoristaDetailScreen | dados reais | R |
| `/atendimentos` | AtendimentosScreen | counts + conversations | R |
| `/atendimentos/:id` | AtendimentoDetalheScreen | detalhe atendimento | R/W |
| `/atendimentos/:id/orcamento` | ElaborarOrcamentoScreen | manage-excursion-budget | W |
| `/configuracoes` | ConfiguracoesScreen | config / bases / rotas Take Me | R/W |

**Edge Functions (admin):** `manage-promotions`, `manage-pricing-routes`, `manage-excursion-budget`, `process-refund`, `create-admin-user` (conforme `queries.ts`).

**Mapas:** Google Maps — `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` em `apps/admin/.env`.
