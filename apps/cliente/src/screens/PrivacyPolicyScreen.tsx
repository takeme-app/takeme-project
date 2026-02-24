import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PrivacyPolicy'>;

export function PrivacyPolicyScreen({ navigation }: Props) {
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

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Política de Privacidade</Text>
        <Text style={styles.updated}>Última atualização: [data genérica]</Text>

        <Text style={styles.sectionTitle}>1. Informações que coletamos</Text>
        <Text style={styles.paragraph}>
          Coletamos informações que você nos fornece ao criar uma conta e usar o aplicativo, tais como 
          nome, e-mail, telefone e dados de pagamento quando aplicável. Também podemos coletar dados de 
          uso do aplicativo e informações técnicas do dispositivo para melhorar nossos serviços.
        </Text>

        <Text style={styles.sectionTitle}>2. Uso das informações</Text>
        <Text style={styles.paragraph}>
          Utilizamos suas informações para fornecer e melhorar os serviços, processar agendamentos, 
          enviar comunicações sobre sua conta e, com seu consentimento, ofertas e novidades. Não 
          vendemos seus dados pessoais a terceiros.
        </Text>

        <Text style={styles.sectionTitle}>3. Compartilhamento</Text>
        <Text style={styles.paragraph}>
          Podemos compartilhar dados com prestadores de serviços que nos auxiliam na operação (por exemplo, 
          processamento de pagamentos e envio de e-mails), sempre sob compromisso de confidencialidade 
          e em conformidade com a legislação aplicável.
        </Text>

        <Text style={styles.sectionTitle}>4. Segurança</Text>
        <Text style={styles.paragraph}>
          Adotamos medidas técnicas e organizacionais para proteger seus dados contra acesso não 
          autorizado, alteração, divulgação ou destruição. A comunicação com nossos servidores 
          utiliza criptografia quando disponível.
        </Text>

        <Text style={styles.sectionTitle}>5. Seus direitos</Text>
        <Text style={styles.paragraph}>
          Você pode acessar, corrigir ou solicitar a exclusão dos seus dados pessoais através das 
          configurações da conta ou entrando em contato conosco. Em determinadas circunstâncias, 
          você também pode solicitar a portabilidade dos dados ou a limitação do tratamento.
        </Text>

        <Text style={styles.sectionTitle}>6. Alterações</Text>
        <Text style={styles.paragraph}>
          Esta política pode ser atualizada periodicamente. Alterações relevantes serão comunicadas 
          pelo aplicativo ou por e-mail. O uso continuado após as alterações constitui aceitação 
          da nova versão.
        </Text>

        <Text style={[styles.paragraph, styles.lastParagraph]}>
          Dúvidas sobre esta política podem ser enviadas pelos canais de contato disponíveis no aplicativo.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 24,
    marginTop: 60,
    marginBottom: 16,
  },
  backArrow: {
    fontSize: 22,
    color: '#000000',
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  updated: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
    marginBottom: 12,
  },
  lastParagraph: {
    marginBottom: 32,
  },
});
