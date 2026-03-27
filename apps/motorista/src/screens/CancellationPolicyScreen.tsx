import { View, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Text } from '../components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../navigation/types';
import { SCREEN_TOP_EXTRA_PADDING } from '../theme/screenLayout';

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

Regra de ouro (sem cobrança surpresa): sempre que houver possibilidade de cobrança, a Take-Me exibirá antes da confirmação a regra e o valor estimado, e disponibilizará no recibo a memória de cálculo.

Em caso de conflito de informações: se houver divergência entre esta Política e a informação exibida no app, prevalecerá a condição mais favorável ao Usuário.

2. Definições operacionais objetivas
• Aceite: momento em que o motorista/parceiro aceita a solicitação no app.
• Deslocamento iniciado: após o aceite, quando o motorista percorre ≥ 500 metros em direção ao ponto de embarque/coleta; ou permanece em rota por ≥ 2 minutos (com GPS ativo).
• Muito próximo: quando o motorista estiver a ≤ 300 metros do ponto ou com ETA ≤ 1 minuto.
• Chegada ao ponto: quando o motorista aciona "Cheguei" no app e estiver dentro do raio de 100 metros do ponto (geolocalização).
• Início da tolerância de espera: começa somente após a "Chegada ao ponto" e envio de notificação ao Usuário no app.

3. Parâmetros financeiros e modelo de cálculo

3.1 Parâmetros
• Taxa mínima (C_min): R$ 80,00
• Teto (C_cap): R$ 250,00
• Tempo: R$ 2,00 por minuto
• Distância: R$ 1,20 por km
• Tolerância de espera (no-show): 8 minutos

3.2 Fórmula
Quando houver cobrança, aplica-se:
Taxa = min( C_cap, max( C_min, (minutos × 2,00) + (km × 1,20) ) )

4. Corridas imediatas (passageiros)

4.1 Cancelamento gratuito
O cancelamento é gratuito quando:
1. ocorrer antes do aceite de um motorista; ou
2. ocorrer dentro da janela de cortesia de 2 minutos após o aceite, desde que não tenha havido deslocamento iniciado.

4.2 Cancelamento com cobrança (proporcional)
Após a cortesia, poderá ser cobrada taxa quando houver deslocamento iniciado, motorista muito próximo ou motorista com chegada ao ponto. A cobrança observará a fórmula única (seção 3).

5. No-show (não comparecimento)

5.1 Tolerância
Se o motorista chegar ao ponto e o Usuário for notificado: aplica-se tolerância gratuita de 8 minutos.

5.2 Encerramento por no-show e cobrança
Se o Usuário não comparecer dentro da tolerância, a corrida poderá ser encerrada como no-show, podendo ser cobrada taxa conforme a fórmula (seção 3).

6. Corridas agendadas (passageiros)

6.1 Cancelamento gratuito
É gratuito quando ocorrer até 120 minutos antes do horário agendado, desde que não exista motorista já confirmado com deslocamento iniciado.

6.2 Cancelamento com cobrança (agendadas)
Poderá haver cobrança quando o cancelamento ocorrer com menos de 120 minutos e/ou houver motorista confirmado/alocado, especialmente se houver deslocamento iniciado. Aplica-se a fórmula única (seção 3).

7. Pequenas cargas (frete/entrega)

7.1 Cancelamento gratuito
O cancelamento é gratuito quando ocorrer antes do aceite ou dentro da cortesia de 2 minutos após o aceite, desde que não tenha havido deslocamento iniciado.

7.2 Cancelamento com cobrança
Após a cortesia, poderá haver cobrança quando houver deslocamento iniciado, motorista muito próximo ou motorista com chegada ao ponto de coleta. Aplica-se a fórmula (seção 3).

8. Cancelamento pelo motorista/parceiro
Quando o cancelamento decorrer do motorista/parceiro, o Usuário não será cobrado.

9. Isenções e reembolso por cobrança indevida
A Take-Me poderá isentar ou reembolsar valores quando houver evidência de falha técnica do app, cobrança fora das regras desta Política, cancelamento dentro da cortesia sem deslocamento iniciado, erro relevante de GPS ou situação de segurança.

10. Reembolsos e estornos
• A Take-Me analisará solicitações em até 7 dias úteis.
• O prazo de efetivação do estorno pode variar conforme banco/operadora/meio de pagamento.
• Pagamentos em dinheiro serão tratados pelo suporte, com devolução por crédito no app, cupom ou Pix (quando disponível).

11. Disputas e contestação
Se o Usuário não concordar com uma cobrança, poderá solicitar revisão em até 7 dias corridos pelo suporte.
Prazo de resposta: até 5 dias úteis.

12. LGPD e uso de dados
Para operar o serviço, prevenir fraudes e resolver disputas, a Take-Me poderá tratar dados como eventos do app (aceite, chegada, cancelamento, no-show), registros de geolocalização e rotas, e comunicações realizadas dentro do app. Esse tratamento observará os princípios de finalidade, necessidade e transparência.

ANEXO — Memória de cálculo (obrigatório no recibo)
Quando houver cobrança, o recibo deve apresentar:
• minutos e km considerados (aceite → cancelamento/encerramento),
• valores unitários (R$ 2,00/min e R$ 1,20/km),
• aplicação de mínimo (R$ 80,00) e teto (R$ 250,00),
• valor final.`;

export function CancellationPolicyScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Política de cancelamento</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.body}>{POLICY}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8 + SCREEN_TOP_EXTRA_PADDING, paddingBottom: 12,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  scroll: { paddingHorizontal: 20, paddingBottom: 48, paddingTop: 8 },
  body: { fontSize: 15, color: '#374151', lineHeight: 24 },
});
