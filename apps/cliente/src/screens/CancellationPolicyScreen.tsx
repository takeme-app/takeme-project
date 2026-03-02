import { View, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Text } from '../components/Text';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../navigation/ProfileStackTypes';

type Props = NativeStackScreenProps<ProfileStackParamList, 'CancellationPolicy'>;

const POLICY = `POLÍTICA DE CANCELAMENTO — TAKE-ME
(PASSAGEIROS E PEQUENAS CARGAS)

Versão: 2.0 (CDC/LGPD)
Vigência: 01/01/2026
Atendimento: suporte@takeme.app.br
Privacidade (LGPD): privacidade@takeme.app.br

1. Objetivo e transparência (informação prévia)
Esta Política explica, de forma clara e antecipada, quando o cancelamento é gratuito e quando pode haver cobrança, além de regras de no-show, disputas e reembolsos, para:
• Corridas de passageiros (imediatas e agendadas); e
• Pequenas cargas (coleta/entrega).

Regra de ouro (sem cobrança surpresa): sempre que houver possibilidade de cobrança, a Take-Me exibirá antes da confirmação (ou imediatamente após o aceite, quando aplicável) a regra e o valor estimado, e disponibilizará no recibo a memória de cálculo.

Em caso de conflito de informações: se houver divergência entre esta Política e a informação exibida no app, prevalecerá a condição mais favorável ao Usuário. A Take-Me não cobrará valores fora dos limites e regras desta Política.

2. Definições operacionais objetivas
Para fins desta Política:
• Aceite: momento em que o motorista/parceiro aceita a solicitação no app.
• Deslocamento iniciado: após o aceite, quando o motorista:
  – percorre ≥ 500 metros em direção ao ponto de embarque/coleta; ou
  – permanece em rota por ≥ 2 minutos (com GPS ativo).
• Muito próximo: quando o motorista estiver a ≤ 300 metros do ponto ou com ETA ≤ 1 minuto.
• Chegada ao ponto: quando o motorista aciona "Cheguei" no app e estiver dentro do raio de 100 metros do ponto (geolocalização).
• Início da tolerância de espera: começa somente após a "Chegada ao ponto" e envio de notificação ao Usuário no app.

3. Parâmetros financeiros e modelo de cálculo (único e consistente)

3.1 Parâmetros
• Taxa mínima (C_min): R$ 80,00
• Teto (C_cap): R$ 250,00
• Tempo: R$ 2,00 por minuto
• Distância: R$ 1,20 por km
• Tolerância de espera (no-show): 8 minutos

3.2 Fórmula
Quando houver cobrança, aplica-se:
Taxa = min( C_cap, max( C_min, (minutos × 2,00) + (km × 1,20) ) )
• minutos e km são apurados do aceite até o cancelamento (ou até o encerramento por no-show/tentativa frustrada), com base nos registros do app (GPS e eventos operacionais).
• A Take-Me sempre aplicará o menor valor possível dentro desta regra, respeitando o teto.

4. Corridas imediatas (passageiros)

4.1 Cancelamento gratuito
O cancelamento é gratuito quando:
1. ocorrer antes do aceite de um motorista; ou
2. ocorrer dentro da janela de cortesia de 2 minutos após o aceite, desde que não tenha havido deslocamento iniciado.
Se o cancelamento ocorrer dentro de 2 minutos, mas já tiver havido deslocamento iniciado, poderá haver cobrança conforme a fórmula, com memória de cálculo no recibo.

4.2 Cancelamento com cobrança (proporcional)
Após a cortesia, poderá ser cobrada taxa quando houver:
• deslocamento iniciado, e/ou
• motorista muito próximo, e/ou
• motorista com chegada ao ponto.
A cobrança observará a fórmula única (seção 3), garantindo proporcionalidade.

5. No-show (não comparecimento) — passageiros e agendadas

5.1 Tolerância
Se o motorista chegar ao ponto e o Usuário for notificado:
• aplica-se tolerância gratuita de 8 minutos.

5.2 Encerramento por no-show e cobrança
Se o Usuário não comparecer dentro da tolerância, a corrida poderá ser encerrada como no-show, podendo ser cobrada taxa conforme a fórmula (seção 3), considerando minutos/km do aceite até o encerramento.
Transparência: o recibo indicará "Chegada", início da tolerância e tempo total de espera.

6. Corridas agendadas (passageiros)

6.1 Cancelamento gratuito
É gratuito quando ocorrer:
• até 120 minutos antes do horário agendado, desde que não exista motorista já confirmado com deslocamento iniciado.

6.2 Cancelamento com cobrança (agendadas)
Poderá haver cobrança quando:
• o cancelamento ocorrer com menos de 120 minutos, e/ou
• houver motorista confirmado/alocado, especialmente se houver deslocamento iniciado.
Cálculo: aplica-se a fórmula única (seção 3), considerando minutos/km do aceite do motorista até o cancelamento.

7. Pequenas cargas (frete/entrega)

7.1 Cancelamento gratuito
O cancelamento é gratuito quando:
1. ocorrer antes do aceite; ou
2. ocorrer dentro da cortesia de 2 minutos após o aceite, desde que não tenha havido deslocamento iniciado.

7.2 Cancelamento com cobrança
Após a cortesia, poderá haver cobrança quando houver:
• deslocamento iniciado, e/ou
• motorista muito próximo, e/ou
• motorista com chegada ao ponto de coleta.
Cálculo: mesma fórmula (seção 3).

7.3 Tentativa frustrada de coleta/entrega (critério objetivo + boa-fé)
Pode ser considerada "tentativa frustrada" quando houver:
• remetente/destinatário indisponível;
• recusa injustificada em entregar/receber;
• endereço incorreto/incompleto que inviabilize a operação; ou
• divergência relevante.
Divergência relevante (objetiva):
• diferença > 20% entre peso/volume declarado e o apresentado; ou
• item proibido/restrito pelas regras da plataforma.
Nessas hipóteses, poderá haver cobrança conforme a fórmula (seção 3), desde que a Take-Me disponha de registros mínimos (ex.: chegada ao ponto, comunicações pelo app, e evento de encerramento por tentativa frustrada).
Se houver necessidade de retorno/devolução, isso deverá ser informado e aceito no app antes de executar.

8. Cancelamento pelo motorista/parceiro (sem penalizar o Usuário)
Quando o cancelamento decorrer do motorista/parceiro, o Usuário não será cobrado.
Exceções (restritas e justificadas): somente mediante evidência objetiva de risco, fraude ou conduta grave imputável ao Usuário (ex.: ameaça registrada em canal oficial), com:
• comunicação do motivo ao Usuário; e
• possibilidade de contestação.

9. Isenções e reembolso por cobrança indevida (proteção do consumidor)
A Take-Me poderá isentar ou reembolsar valores (integral ou parcialmente) quando houver evidência de:
• falha técnica do app;
• cobrança fora das regras desta Política;
• cancelamento dentro da cortesia sem deslocamento iniciado;
• erro relevante de GPS/eventos operacionais;
• situação de segurança.

10. Reembolsos e estornos (prazo claro)
• A Take-Me analisará solicitações em até 7 dias úteis.
• O prazo de efetivação do estorno pode variar conforme banco/operadora/meio de pagamento.
• Pagamentos em dinheiro serão tratados pelo suporte, com devolução por crédito no app, cupom ou Pix (quando disponível), após aprovação.

11. Disputas e contestação (canal e SLA)
Se o Usuário não concordar com uma cobrança, poderá solicitar revisão em até 7 dias corridos:
• No app: Ajuda → Corridas/Entregas → Cancelamento/Cobrança; ou
• Pelo suporte.
Prazo de resposta: até 5 dias úteis, com:
• manutenção da cobrança, ou
• estorno integral, ou
• estorno parcial (com memória de cálculo).

12. LGPD e uso de dados (finalidade e minimização)
Para operar o serviço, prevenir fraudes e resolver disputas, a Take-Me poderá tratar dados como:
• eventos do app (aceite, chegada, cancelamento, no-show),
• registros de geolocalização e rotas,
• comunicações realizadas dentro do app.
Esse tratamento observará os princípios de finalidade, necessidade e transparência, e será utilizado apenas para execução do serviço, segurança e resolução de conflitos, conforme a Política de Privacidade.

ANEXO — Memória de cálculo (obrigatório no recibo)
Quando houver cobrança, o recibo deve apresentar:
• minutos e km considerados (aceite → cancelamento/encerramento),
• valores unitários (R$ 2,00/min e R$ 1,20/km),
• aplicação de mínimo (R$ 80,00) e teto (R$ 250,00),
• valor final.`;

export function CancellationPolicyScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
        activeOpacity={0.7}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Text style={styles.backArrow}>←</Text>
      </TouchableOpacity>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.body}>{POLICY}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f1f1',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 24,
    marginTop: 60,
    marginBottom: 16,
  },
  backArrow: { fontSize: 22, color: '#0d0d0d', fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 48 },
  body: { fontSize: 15, color: '#374151', lineHeight: 24 },
});
