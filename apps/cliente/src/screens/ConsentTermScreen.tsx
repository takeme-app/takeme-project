import { View, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Text } from '../components/Text';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../navigation/ProfileStackTypes';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ConsentTerm'>;

const TERM = `TERMO DE CONSENTIMENTO (LGPD) — TAKE-ME

Versão: 1.0
Data: 02/01/2026
Controlador: Trinitas Tecnologia e Inovação Ltda. ("Takeme")
CNPJ: 999.999.999-99
Contato (Privacidade/DPO): privacidade@takeme.app.br

Este Termo explica e registra o seu consentimento, quando necessário, para o tratamento de dados pessoais pela Takeme, nos termos da Lei nº 13.709/2018 (LGPD).

1) Definições rápidas
• Dados pessoais: informações que identificam ou podem identificar você (ex.: nome, telefone, localização).
• Tratamento: qualquer uso de dados (coletar, armazenar, compartilhar etc.).
• Controlador: quem decide sobre o tratamento (Takeme).
• Operadores: parceiros que tratam dados em nome da Takeme (ex.: provedores de nuvem, antifraude, pagamento).

2) Importante: o que NÃO depende de consentimento
Para prestar o serviço (chamar corrida/entrega, calcular preço, segurança, suporte, prevenção a fraude, emissão de recibos), a Takeme pode tratar dados com base em execução de contrato e/ou legítimo interesse, conforme a Política de Privacidade.
Este Termo trata dos casos em que a Takeme pede consentimento (por exemplo, marketing e certas permissões do aparelho).

3) Seus consentimentos (marque apenas o que concordar)
Você pode aceitar ou recusar os itens opcionais. Recusar não impede o uso do serviço, exceto quando a permissão for indispensável para a funcionalidade solicitada (ex.: localização em primeiro plano para mostrar motoristas próximos).

3.1 Localização (permissões do dispositivo)
( ) Concordo que a Takeme colete e utilize minha localização em primeiro plano (enquanto uso o app) para:
• sugerir ponto de embarque/coleta,
• calcular rotas/ETA,
• melhorar a precisão do atendimento e segurança.
( ) Concordo que a Takeme colete e utilize minha localização em segundo plano (mesmo quando o app não estiver aberto), apenas durante corridas/entregas em andamento, para:
• acompanhar o trajeto,
• reforçar segurança (ex.: detecção de desvios),
• registrar evidências para disputas (ex.: no-show, cancelamento).
Você pode desativar a localização a qualquer momento nas permissões do aparelho. A desativação pode limitar funcionalidades de rota/ETA e segurança.

3.2 Comunicações e marketing
( ) Concordo em receber comunicações promocionais (e-mail, SMS, WhatsApp, push) sobre ofertas, cupons e novidades da Takeme.
( ) Concordo em receber pesquisas de satisfação e comunicações sobre melhorias de serviço.
Você pode cancelar o recebimento de promoções a qualquer momento pelo app ou pelo link/opt-out da mensagem.

3.3 Compartilhamento de dados com parceiros (opcional)
( ) Concordo que a Takeme compartilhe meus dados de contato e preferências com parceiros para ofertas conjuntas e benefícios (ex.: seguros, clubes, vantagens), com transparência e possibilidade de opt-out.
A Takeme não vende seus dados. Quando houver parceiros, o compartilhamento será limitado ao necessário e com obrigações de proteção.

3.4 Dados sensíveis (quando aplicável)
A Takeme não solicita dados sensíveis como regra. Caso você informe voluntariamente dados de saúde (ex.: necessidade de acessibilidade) ou outro dado sensível em suporte/cadastro:
( ) Concordo com o tratamento desses dados para atender minha solicitação e melhorar meu atendimento, pelo tempo necessário.

4) Para que usamos e com quem compartilhamos (resumo)
Quando você consente nos itens acima, seus dados podem ser tratados para:
• melhorar sua experiência no app (ex.: localização, notificações),
• personalizar ofertas (se você consentir),
• segurança e prevenção a fraudes (quando aplicável).
Podemos compartilhar dados com:
• provedores de tecnologia (hospedagem, analytics, notificações),
• meios de pagamento e antifraude,
• motoristas/parceiros apenas o necessário para a corrida/entrega (ex.: nome, ponto, contato mascarado quando possível),
• autoridades mediante obrigação legal.

5) Por quanto tempo guardamos
Os dados serão armazenados:
• pelo tempo necessário para cumprir as finalidades informadas,
• para cumprimento de obrigações legais/regulatórias,
• e para resguardar direitos (ex.: prazos de contestação/disputas),
conforme a Política de Privacidade.

6) Seus direitos (LGPD)
Você pode solicitar:
• confirmação e acesso, correção, anonimização, portabilidade (quando aplicável),
• informação sobre compartilhamentos,
• revogação do consentimento,
• eliminação de dados tratados com base no consentimento (quando possível).
Canais: privacidade@takeme.app.br.

7) Revogação do consentimento
Você pode revogar qualquer consentimento a qualquer momento, no app e/ou por contato com privacidade@takeme.app.br.
A revogação não afeta tratamentos realizados antes do pedido, nem aqueles baseados em outras bases legais (execução de contrato/obrigações legais).

8) Declaração final
Ao marcar as opções acima e prosseguir, declaro que:
• li e compreendi este Termo,
• tive acesso à Política de Privacidade,
• estou ciente de que posso gerenciar permissões e revogar consentimentos.

Nome: ___________________________
CPF (opcional): __________________
Data: //______
Identificador do usuário (app): __________________`;

export function ConsentTermScreen({ navigation }: Props) {
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
        <Text style={styles.body}>{TERM}</Text>
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
