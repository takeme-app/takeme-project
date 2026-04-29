# Catálogo de notificações — apps Motorista/Preparador e Cliente

Documento gerado a partir do código (migrations SQL, Edge Functions e `dispatch-notification-fcm`). O app **Takeme Motorista** (slug FCM `motorista`) é usado por **motoristas** e **preparadores** (encomendas e excursão). O app **Cliente** usa o slug `cliente`.

Todas as entradas em `public.notifications` disparam **FCM** via webhook → `dispatch-notification-fcm` (salvo indicação em contrário). O utilizador pode desligar grupos em **preferências** (`public.should_notify_user` / `notification_preferences`), exceto eventos de conta críticos onde o código força envio.

---

## 1. App Motorista (`target_app_slug = motorista`)

| Título (push) | Corpo (resumo) | Quando acontece | Origem |
|----------------|------------------|-----------------|--------|
| **Você recebeu uma nova Solicitação de Viagem!** | Clique para visualizar a solicitação. | Nova reserva (`bookings`) com status `pending` ou `paid` na viagem do motorista. | Trigger `notify_driver_new_booking_request` |
| **Nova encomenda na sua viagem** | Um cliente adicionou um envio à sua rota… | Encomenda (`shipments`) associada à viagem do motorista (insert ou mudança de `scheduled_trip_id`), status adequado, sem `base_id`, sem `driver_id` na encomenda. | `notify_driver_shipment_on_trip` |
| **Sua viagem está em andamento.** | Viagem iniciada: origem → destino… | Primeira vez que `scheduled_trips.driver_journey_started_at` é preenchido. | `notify_driver_trip_started` |
| **Viagem finalizada. Parabéns!** | Você concluiu a viagem… | `scheduled_trips.status` → `completed`. | `notify_driver_trip_lifecycle` |
| **Sua viagem está fechada, confira quem vai com você!** | N encomendas, M passageiros… | Viagem `active`, `seats_available` passa de &gt;0 para 0. | `notify_driver_trip_lifecycle` |
| **Um passageiro cancelou a Viagem!** | Clique para visualizar os detalhes… | Reserva cancelada pelo passageiro (`bookings`: de `paid`/`confirmed` para `cancelled`, excluindo motivos driver/system/admin). | `notify_driver_activity_status_changed` |
| **Sua atividade de {viagem/encomenda/dependente} mudou de status** | Sua {entidade} tem uma nova atualização… | Outras mudanças de status em booking/shipment/dependent_shipment relevantes ao motorista. | `notify_driver_activity_status_changed` |
| **Cadastro Aprovado! Takeme** / **Cadastro de Preparador Excursão Aprovado! Takeme** / **Cadastro de Preparador de Encomendas Aprovado! Takeme** | Textos específicos por papel. | `worker_profiles.status` → `approved` (motorista, preparador excursão ou preparador encomendas). | `notify_driver_account_status_change` |
| **Cadastro de Motorista Reprovado! Takeme** / **Cadastro de Preparador Excursão Reprovado! Takeme** / **Cadastro de Preparador de Encomendas Reprovado! Takeme** | Mensagem de reprovação padrão. | `worker_profiles.status` → `rejected`. | Idem |
| **Você recebeu um pagamento!** | Aee Parabéns! Confira seu Pagamento! | `payouts.status` passa a `paid`. | `notify_driver_payment_received` |
| **Sua Excursão está em andamento.** | Acompanhe o andamento… | Excursão (`excursion_requests`) → `in_progress`. | `notify_preparer_excursion_phase_change` |
| **Sua Excursão Finalizou.** | Obrigado pela operação!… | Excursão → `completed`. | Idem |
| **Sua atividade de excursão mudou de status** | Sua excursão tem uma nova atualização… | Outras transições de status da excursão (exceto as cobertas acima). | `notify_preparer_excursion_activity_status_changed` |
| **Sua viagem inciará em 40 minutos** | Prepare-se para a saída da excursão… | Cron `notify-preparer-excursion-upcoming`: ~40 min antes de `scheduled_departure_at`, idempotência por coluna de controlo. | Edge Function |
| **Você está indo coletar o pacote XXXXX** | Abra o app para navegar… | `shipments.preparer_pickup_started_at` preenchido. | `notify_preparer_shipment_phase_change` |
| **Você chegou ao cliente!** | Confirme o recebimento… | `shipments.preparer_arrived_at_client_at` preenchido. | Idem |
| **Indo para a base** | Boa viagem!… | `shipments.preparer_to_base_started_at` preenchido. | Idem |
| **Você chegou a base, entregue o pacote.** | Finalize o procedimento… | `shipments.preparer_arrived_at_base_at` preenchido. | Idem |
| **Sua atividade de encomenda mudou de status** | Sua encomenda tem uma nova atualização… | Mudança de `shipments.status` com `preparer_id` definido. | `notify_preparer_shipment_activity_status_changed` |
| **Falta 1 hora para iniciar sua próxima Viagem!** | Prepare-se para origem → destino… | Cron `notify-driver-upcoming-trips`: janela ~1 h antes de `departure_at`, idempotência `upcoming_1h_notified_at`. | Edge Function |
| **Recebimento automático liberado 🎉** | Stripe concluiu a análise… pagamentos via PIX. | Webhook Stripe: conta Connect passa a ter cobranças habilitadas (primeira vez). | `stripe-webhook` |
| **Recebimento automático liberado 🎉** | (Similar ao webhook.) | Sincronização Connect aprova cobranças. | `stripe-connect-sync` |
| **Conta criada** | Seu cadastro foi enviado… | Conclusão de fluxo de cadastro motorista (`create-motorista-account`). | Edge Function |
| **Você recebeu uma gorjeta** | O passageiro enviou uma gorjeta de R$ … | Após cobrança de gorjeta bem-sucedida (`charge-tip`). | Edge Function |
| **Solicitação expirada** | Você não respondeu a tempo… | Cron `expire-assignments`: assignment expirado. | Edge Function |

**Chat (motorista como destinatário):** quando o cliente envia mensagem na conversa motorista–cliente, o título é **Nova mensagem da viagem** (conteúdo truncado). Quando o admin envia no fluxo de suporte e o destinatário tem perfil de worker, o motorista pode receber **Takeme Suporte — Nova mensagem**. Função `notify_chat_message_received`.

---

## 2. App Cliente (`target_app_slug = cliente`)

| Título (push) | Corpo (resumo) | Quando acontece | Origem |
|----------------|------------------|-----------------|--------|
| **Motorista a caminho** | O motorista iniciou a viagem rumo a … | Primeiro preenchimento de `driver_journey_started_at` na viagem; para quem tem booking pago/confirmado, envio dependente ou encomenda na mesma viagem. Inclui `fcm_android_tag` para atualizar ETA. | `notify_passengers_driver_journey_started` |
| **Sua viagem está em andamento.** | Boa viagem!… | Booking: `paid` → `confirmed` (embarque confirmado pelo motorista). | `notify_client_booking_phase_change` |
| **Você chegou ao destino.** | Viagem concluída… | Booking: `confirmed` → `paid` após desembarque. | Idem |
| **Encomenda em andamento ao destino!** | Sua encomenda foi coletada… | Encomenda: `confirmed` → `in_progress`. | `notify_client_shipment_phase_change` |
| **Encomenda chegou ao destino!** | Sua encomenda foi entregue… | Encomenda: `in_progress` → `delivered`. | Idem |
| **Preparador a caminho** | O preparador saiu em direção ao seu endereço… | `shipments.preparer_pickup_started_at` preenchido. | `notify_client_shipment_preparer_milestones` |
| **O preparador chegou** | Informe o código de confirmação… | `shipments.preparer_arrived_at_client_at` preenchido. | Idem |
| **Sua atividade de {viagem/encomenda/…} mudou de status** | Sua {entidade} tem uma nova atualização… | Mudanças de status genéricas em booking/shipment/dependent_shipment/excursion não cobertas por triggers específicos. | `notify_client_activity_status_changed` |
| **Sua Excursão está em fase de check in de ida.** | Abra o app… | `excursion_requests.check_in_ida_started_at` preenchido. | `notify_client_excursion_phase_change` |
| **Sua Excursão está em fase de check in de volta.** | Abra o app… | `check_in_volta_started_at` preenchido. | Idem |
| **Sua excursão está em andamento** | Acompanhe sua excursão… | Excursão → `in_progress`. | Idem |
| **Sua excursão finalizou.** | Esperamos que você tenha aproveitado!… | Excursão → `completed`. | Idem |
| **Dependente Cadastrado com Sucesso!** | Clique pra ver o cadastro… | Dependente → `validated`. | `notify_dependent_validated` |
| **Dependente não aprovado!** | Texto longo (+ motivo opcional). | Dependente → `rejected`. | Idem |
| **Seu dependente está chegando ao destino** | Acompanhe o trajeto… | Envio dependente: `confirmed` → `in_progress`. | `notify_client_dependent_shipment_phase_change` |
| **Dependente Chegou ao Destino!** | Aee Parabéns!… | Envio dependente: `in_progress` → `delivered`. | Idem |
| **Motorista está a cerca de 5 minutos** | Prepare-se para o embarque… | Cron `notify-passenger-driver-proximity`: ETA linear ~4–8 min ao ponto de embarque (booking `paid` ou dependente `confirmed`), uma vez por idempotência. | Edge Function |
| **Motorista chegou a você** | O motorista está no ponto… | Mesmo cron: distância &lt; ~120 m ao embarque (variantes booking / dependente). | Idem |
| **Conta criada** | Telefone ou e-mail verificado… | `verify-phone-code` / `verify-email-code` após registo. | Edge Functions |
| **Cartão cadastrado** | Seu cartão foi adicionado… | `save-payment-method` sucesso. | Edge Function |
| **Reserva cancelada** / **Reserva cancelada com estorno** | Mensagem conforme política de cancelamento. | `cancel-booking`. | Edge Function |
| **Viagem cancelada pelo motorista** | Estorno integral… | `cancel-scheduled-trip` quando há reembolso ao passageiro. | Edge Function |
| **Pedido não confirmado — estorno** | Motorista iniciou viagem sem aceitar… | `refund-journey-start-not-accepted` após estorno. | Edge Function |
| **Solicitação expirada** | Motorista não respondeu a tempo… | `expire-assignments` (lado cliente). | Edge Function |
| **Estorno processado** | Valor será devolvido… | `process-refund` após estorno. | Edge Function |
| **Orçamento da excursão pronto** | Valor total… aceite no app. | `manage-excursion-budget` quando orçamento fica disponível. | Edge Function |

**Chat (cliente):** na conversa motorista–cliente, quando o motorista envia mensagem: **Nova mensagem da viagem**. No suporte (admin → utilizador sem worker_profile): **Takeme Suporte — Nova mensagem**. Função `notify_chat_message_received`.

---

## 3. Atualização contínua de ETA (sem nova linha na inbox)

| Conteúdo do push | Quando | Origem |
|------------------|--------|--------|
| **Motorista a X min** (mesmo *slot* Android / tag `passenger_eta_*`) | Cron `notify-passenger-driver-proximity`, enquanto o passageiro ainda não embarcou; substitui visualmente a notificação anterior com o mesmo tag. | FCM enviado diretamente pela Edge Function (não passa por nova linha em `notifications` por cada tick). |

---

## 4. Observações

1. **Preferências:** a maioria das categorias respeita `should_notify_user`; contas aprovadas/reprovadas e alguns eventos de sistema podem ignorar grupos — ver função atual no SQL.
2. **`manage-promotions`:** o código tenta inserir uma notificação de promoção **sem `user_id`**; como `notifications.user_id` é `NOT NULL`, o insert tende a falhar até ser corrigido (ex.: fan-out por utilizadores ou fila dedicada).
3. **`charge-tip`:** o insert de gorjeta pode não definir `target_app_slug`; o default da coluna é `cliente` — convém garantir `motorista` para o token FCM correto do motorista.
4. **Textos ao longo do tempo:** migrations mais recentes substituem funções PL/pgSQL; este catálogo reflete o estado atual do repositório (incl. `20260602110000_pdf_proximity_chat_fcm_tags.sql` para chat, proximidade e tags FCM).

---

*Última revisão: inventário estático do código no repositório Take Me.*
