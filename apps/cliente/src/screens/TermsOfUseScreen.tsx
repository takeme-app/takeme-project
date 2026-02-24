import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'TermsOfUse'>;

export function TermsOfUseScreen({ navigation }: Props) {
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
        <Text style={styles.title}>Termos de Uso</Text>
        <Text style={styles.updated}>Última atualização: [data genérica]</Text>

        <Text style={styles.sectionTitle}>1. Aceitação dos termos</Text>
        <Text style={styles.paragraph}>
          Ao acessar e utilizar o aplicativo Take Me, você concorda em cumprir e estar vinculado a estes Termos de Uso. 
          Se você não concordar com qualquer parte destes termos, não deverá utilizar nossos serviços.
        </Text>

        <Text style={styles.sectionTitle}>2. Descrição do serviço</Text>
        <Text style={styles.paragraph}>
          O Take Me oferece plataforma para agendamento de viagens, envios e serviços relacionados. 
          Os serviços estão sujeitos a alterações, e nos reservamos o direito de modificar ou descontinuar 
          funcionalidades mediante aviso prévio quando aplicável.
        </Text>

        <Text style={styles.sectionTitle}>3. Cadastro e conta</Text>
        <Text style={styles.paragraph}>
          Para utilizar determinadas funcionalidades, é necessário criar uma conta fornecendo informações 
          verdadeiras e atualizadas. Você é responsável por manter a confidencialidade de sua senha e por 
          todas as atividades realizadas em sua conta.
        </Text>

        <Text style={styles.sectionTitle}>4. Uso adequado</Text>
        <Text style={styles.paragraph}>
          O usuário compromete-se a utilizar o aplicativo de forma lícita, sem violar direitos de terceiros 
          nem normas aplicáveis. É vedado o uso para fins fraudulentos, abusivos ou que prejudiquem a 
          operação do serviço ou de outros usuários.
        </Text>

        <Text style={styles.sectionTitle}>5. Limitação de responsabilidade</Text>
        <Text style={styles.paragraph}>
          Na máxima extensão permitida pela lei, o Take Me não se responsabiliza por danos indiretos, 
          incidentais ou consequenciais decorrentes do uso ou da impossibilidade de uso dos serviços. 
          A responsabilidade total não excederá o valor efetivamente pago pelo usuário nos últimos 12 meses.
        </Text>

        <Text style={styles.sectionTitle}>6. Alterações</Text>
        <Text style={styles.paragraph}>
          Estes termos podem ser alterados a qualquer momento. Alterações relevantes serão comunicadas 
          por meio do aplicativo ou e-mail. O uso continuado após as alterações constitui aceitação 
          dos novos termos.
        </Text>

        <Text style={[styles.paragraph, styles.lastParagraph]}>
          Em caso de dúvidas, entre em contato conosco pelos canais disponíveis no aplicativo.
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
