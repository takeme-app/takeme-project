# Pagamentos no Take Me — explicação em linguagem simples

Este texto explica **como o dinheiro entra, onde fica e para onde pode ir**, sem detalhes de programação. Serve para equipe de produto, suporte, jurídico ou qualquer pessoa que precise entender o fluxo.

---

## 1. O que é o Stripe (e por que ele aparece)

O **Stripe** é um serviço externo (como um “banco digital parceiro”) que:

- guarda os **dados do cartão** de forma segura (o app não armazena número completo do cartão);
- **cobra** o passageiro ou quem contrata o serviço;
- permite **estornar** quando algo dá errado ou é cancelado;
- permite **repassar parte do valor** ao motorista, quando a conta do motorista está vinculada (Stripe Connect).

Na prática: **quem paga paga para o Stripe**; o Stripe depois **distribui** conforme as regras que configuramos (plataforma x motorista).

---

## 2. Quem é quem nesta história

| Papel | O que faz |
|--------|-----------|
| **Cliente** | Contrata viagem ou envio e paga (cartão, etc.). |
| **Plataforma (Take Me)** | Fica com a **taxa administrativa** (comissão) quando essa regra está ativa no preço. |
| **Motorista (viagem ou entrega na estrada)** | Pode receber **parte do que o cliente pagou**, conforme o valor “congelado” na reserva e se ele tiver cadastro de recebimento no Stripe. |
| **Preparador de encomendas (na base)** | No modelo de negócio combinado, costuma ser **diária fixa** definida pelo admin — **não** é “um pouquinho de cada encomenda” só por ser preparador; o repasse por **valor do pedido** pesa mais no **motorista que entrega**. |
| **Admin** | Define preços/trechos, pode marcar repasses como pagos, aciona estornos quando o fluxo administra isso. |

---

## 3. Viagem compartilhada (passageiro)

### O que o cliente vê

1. Escolhe a viagem e confirma.
2. O sistema **registra a reserva** (como um “pedido pendente”).
3. Se o pagamento for com **cartão**, o app chama o servidor, que cobra no **Stripe**.
4. Se der certo, a reserva passa a **paga** e fica registrado o identificador do pagamento no Stripe.

### Onde entra o “split” (divisão com o motorista)

- O preço da reserva pode incluir: **subtotal** (valor “do serviço”) + **taxa da plataforma** (o que fica para a Take Me).
- O sistema guarda esses valores na reserva para **não mudar depois** (histórico claro em caso de disputa).
- Se o motorista tiver **conta Stripe Connect** cadastrada e a viagem já tiver motorista atribuído, a cobrança pode ir com **parte para o motorista** e **parte para a plataforma**, conforme o cálculo salvo.
- Se o motorista **ainda não** tiver conta Connect, por padrão o valor **inteiro** fica na conta da plataforma no Stripe até existir cadastro de repasse.

### Registro interno de “quanto deve ao motorista”

Depois que a reserva fica paga, o sistema pode criar uma linha na tabela de **repasses (`payouts`)**: “tanto de bruto, tanto para o worker, tanto para admin”, em **pendente**, até alguém marcar como pago no fluxo operacional (ex.: admin ou processo de Pix real).

---

## 4. Encomendas (envios)

### O que mudou na prática

- O cliente **cria o pedido de envio** no app.
- Se pagar com **cartão de crédito ou débito**, o app **chama o servidor** para cobrar no Stripe **depois** de criar o pedido.
- Se o pagamento **falhar**, o pedido é **cancelado** para não ficar “confirmado sem dinheiro”.
- **Pix** no fluxo de envio, hoje, é mais **placeholder de interface** (não cobra automaticamente no Stripe como o cartão); evoluir Pix é um passo futuro.

### Por que envio é “mais simples” que viagem no split automático

Na entrega por **motorista na estrada**, o repasse por valor do pedido faz sentido. Na **base (preparador)**, a regra de negócio é outra (diária fixa do admin). Por isso, **nesta fase**, a cobrança de envio no Stripe foi feita de forma **simples**: valor **inteiro** para a plataforma; repasses específicos (diária, motorista) seguem regra de produto e processos internos/`payouts`.

### Exemplo numérico (só para entender a conta)

Imagine que o **admin** cadastrou no painel um trecho de encomenda (**preparador de envios**) assim:

- **Origem** (cidade A) e **destino** (cidade B) parecidos com o que o cliente escolheu no app.
- Modo de preço: **valor fixo** de **R$ 25,00** pelo trecho (isso vira a “base” do catálogo).
- **Taxa administrativa** da plataforma nesse trecho: **8%** sobre o subtotal (valor antes da taxa).

O cliente marca um pacote **médio**. No app, a regra de produto aplica um **ajuste por tamanho** em cima da base (ex.: multiplicar a base por **1,12** para médio — números ilustrativos).

| Etapa | Conta (em reais) | Resultado |
|--------|-------------------|-------------|
| Base do trecho (catálogo) | R$ 25,00 | R$ 25,00 |
| Subtotal (após tamanho médio) | R$ 25,00 × 1,12 | **R$ 28,00** |
| Taxa da plataforma (8%) | 8% de R$ 28,00 | **R$ 2,24** |
| **Total que o cliente vê e paga** | R$ 28,00 + R$ 2,24 | **R$ 30,24** |

Na prática, o sistema **grava** no pedido de envio: subtotal, taxa, total e qual trecho do catálogo foi usado — assim o valor **não muda depois** naquele pedido, mesmo que o admin altere o preço do trecho no futuro.

**Se o trecho for “por km”** em vez de fixo: a base deixa de ser um valor único e passa a ser “**quantos quilômetros** entre origem e destino × preço por km cadastrado”; depois entram o mesmo tipo de ajuste por tamanho (se houver) e a taxa administrativa em cima do subtotal.

---

## 5. Estorno (devolução)

- Quando um administrador (ou um processo automático autorizado) pede **estorno**, o servidor fala com o Stripe para **devolver** ao cliente.
- Só funciona bem se existir **registro do pagamento** (identificador do Stripe) guardado no pedido.
- Depois do estorno, o pedido costuma ser marcado como **cancelado** e o cliente pode receber uma **notificação**.

---

## 6. Webhook (o que é, em uma frase)

É um **avisinho automático** do Stripe para o nosso servidor: “esse pagamento foi concluído de verdade”.  
Serve de **rede de segurança**: se o celular perder internet no segundo exato da compra, o servidor ainda pode **atualizar** o pedido como pago quando o Stripe confirmar.

---

## 7. Cadastro do motorista para receber (Stripe Connect)

- O motorista precisa completar um **cadastro de recebedor** no Stripe (dados bancários, identidade, etc.).
- O app pode abrir um **link seguro** gerado pelo servidor (`stripe-connect-link`) para ele preencher isso.
- Quando termina, guardamos o **ID da conta conectada** para as próximas cobranças com split.

---

## 8. Glossário rápido

| Termo | Em poucas palavras |
|--------|-------------------|
| **Cliente Stripe** | “Ficha” do passageiro no Stripe para cobrar cartões dele. |
| **PaymentIntent** | Um “pedido de cobrança” único no Stripe (com valor e status). |
| **Connect / conta conectada** | Conta do **motorista** no Stripe para receber parte automática. |
| **Payout (no nosso banco de dados)** | **Registro interno** de quanto repassar a quem; não é o mesmo que “Pix já caiu na conta” até o processo financeiro concluir. |
| **Taxa administrativa** | Parte que fica com a **plataforma**, conforme percentual/trecho definido no admin. |

---

## 9. Próximos passos (o que ainda falta ou convém fazer)

Estes itens são **operacionais e de produto**, não estão todos “no papel” do dia a dia até vocês concluírem:

1. **Aplicar a migration** no banco (colunas de Stripe e datas de atualização em envios, etc.), pelo fluxo normal do projeto (`supabase db push` ou CI).
2. **Publicar as funções de servidor** (Edge Functions) no Supabase: cobrança de viagem, cobrança de envio, webhook, link Connect, estorno, expiração de atribuições — conforme o que vocês já usam em deploy.
3. **Configurar segredos** no painel do Supabase: chave secreta do Stripe, segredo do **webhook**, e URLs de retorno do Connect (domínio real do app).
4. **No painel do Stripe**, criar o endpoint de webhook apontando para `…/functions/v1/stripe-webhook` e assinar pelo menos `payment_intent.succeeded`.
5. **No app motorista**, colocar um fluxo claro (“Receber pagamentos”) que chama `stripe-connect-link` e abre o link no navegador / WebView.
6. **Cron ou agendador** para `expire-assignments` (ex.: a cada 5 minutos), com autenticação de serviço, para expirar pedidos não respondidos e tentar estorno quando couber.
7. **Pix em envios**: definir regra de produto e implementar cobrança Pix real (hoje o foco foi cartão).
8. **Conferência financeira**: alinhar `payouts` com o que o financeiro paga (Pix manual, outro PSP, etc.) e treinar admin/suporte.

---

## 10. Em uma frase

**O cliente paga pelo Stripe; a plataforma registra quanto é dela e quanto é do motorista; o repasse “automático” ao motorista depende de ele ter Connect; preparador de base segue a regra de diária que vocês definirem; estornos e webhooks amarram tudo ao que realmente aconteceu no cartão.**

Se algo neste documento divergir de uma decisão nova de negócio, **atualizem este arquivo** para continuar sendo a referência “para leigo”.
