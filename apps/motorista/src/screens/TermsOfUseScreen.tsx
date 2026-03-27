import { View, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Text } from '../components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { SCREEN_TOP_EXTRA_PADDING } from '../theme/screenLayout';

type Props = NativeStackScreenProps<RootStackParamList, 'TermsOfUse'>;

export const TERMS = `TERMOS DE USO — TAKE-ME

Versão: 1
Data de vigência: [01/01/2026]
Última atualização: [09/02/2026]

Bem-vindo(a) à Take-me. Estes Termos de Uso ("Termos") regulam o uso do aplicativo Take-me e serviços relacionados ("Plataforma"). Ao criar uma conta, acessar ou utilizar a Plataforma, você declara que leu, entendeu e concorda com estes Termos e com a Política de Privacidade.

1) Identificação do responsável pela Plataforma
A Plataforma Take-me é disponibilizada por Trinitas Tecnologia e Inovação Ltda., CNPJ (provisório) 999.999.999/9999-99 ("Take-me").
• Suporte/Atendimento: suporte@takeme.app.br
• Canal de Privacidade (Encarregado/DPO): privacidade@takeme.app.br

2) Definições
Para facilitar a leitura, estes Termos usam as definições abaixo:
• Plataforma: aplicativo Take-me (iOS/Android), site e canais oficiais de atendimento.
• Usuário/Passageiro: pessoa que solicita transporte de pessoas pela Plataforma.
• Solicitante de Frete/Remetente: pessoa que solicita transporte de pequenas cargas.
• Motorista: prestador cadastrado que realiza corridas/fretes aceitos via Plataforma.
• Corrida/Viagem: deslocamento de pessoas solicitado pela Plataforma.
• Frete/Entrega: transporte de pequenas cargas solicitado pela Plataforma.
• Conta: cadastro do Usuário/Motorista para acesso à Plataforma.

3) O que é a Take-me e como o serviço funciona
3.1. A Take-me é uma plataforma de tecnologia que intermedia solicitações de transporte de pessoas e pequenas cargas, conectando Usuários e Motoristas.
3.2. O serviço pode ser ofertado com foco em conforto, segurança e sustentabilidade (incluindo mas não só, veículos 100% elétricos, quando disponíveis), podendo existir alternativas operacionais (ex.: integração com táxis/parceiros em caso de indisponibilidade), conforme regras e disponibilidade exibidas no app.
3.3. A Take-me pode operar inicialmente em rotas específicas (ex.: Viana ↔ São Luís) e expandir áreas conforme estratégia e disponibilidade.

4) Aceite, elegibilidade e conta
4.1. Para usar a Plataforma, você deve:
• ter capacidade legal para contratar e/ou a idade mínima exigida,
• fornecer informações verdadeiras, completas e atualizadas,
• manter seus dados de login em sigilo.
4.2. Você é responsável por todas as ações realizadas na sua Conta. Se suspeitar de uso indevido, comunique imediatamente o suporte.
4.3. A Take-me pode solicitar validações adicionais (ex.: documento, selfie, confirmação de telefone/e-mail), para segurança, prevenção à fraude e/ou requisitos operacionais.

5) Regras para Usuários (transporte de pessoas)
5.1. Solicitação e aceite: ao solicitar uma corrida, a Plataforma buscará Motoristas disponíveis. A aceitação depende de disponibilidade, cobertura e regras operacionais.
5.2. Informações e cooperação: você deve informar corretamente local de embarque/desembarque, destino, paradas e observações relevantes.
5.3. Conduta: é proibido:
• portar itens ilícitos ou colocar terceiros em risco,
• praticar assédio, discriminação, ameaças, violência ou qualquer conduta ofensiva,
• danificar o veículo ou causar sujeira excessiva,
• solicitar que o motorista viole leis de trânsito ou regras de segurança.
5.4. A violação destas regras pode levar a suspensão ou bloqueio da Conta.

6) Regras para pequenas cargas (frete/entrega)
6.1. O solicitante deve fornecer informações corretas sobre a carga (tipo, dimensões/peso aproximado, fragilidade e instruções).
6.2. Embalagem e preparo: a embalagem adequada da carga é responsabilidade do solicitante, salvo serviço adicional formalmente contratado.
6.3. Itens proibidos: é proibido solicitar o transporte de:
• itens ilegais, drogas, armas, explosivos, munições,
• materiais perigosos/controle especial,
• animais vivos (salvo se a Plataforma permitir e houver regras específicas),
• itens de alto valor/alto risco (ex.: joias, grandes quantias) sem acordo específico.
6.4. Entrega e insucesso: se o destinatário não estiver disponível, podem ser aplicadas regras de nova tentativa, devolução e/ou taxas adicionais, conforme exibido no app.
6.5. Valor declarado, itens frágeis e embalagem: o Remetente é responsável por declarar corretamente o conteúdo e, quando aplicável, o valor estimado da carga, bem como por embalar de forma adequada e segura. Itens frágeis devem ser claramente identificados e embalados.
6.6. Limite de responsabilidade e sinistros (avaria/extravio):
(a) Salvo quando a lei determinar de forma diversa, a responsabilidade da Take-me (como intermediadora) e/ou do Motorista, quando aplicável, poderá ser limitada ao valor declarado da carga, por solicitação, excluídos lucros cessantes e danos indiretos.
(b) Não haverá responsabilidade por: embalagem inadequada; informações incorretas sobre a carga; itens proibidos; desgaste natural; caso fortuito/força maior; ato de terceiros; ou quando o Remetente/Destinatário contribuir para o dano.
(c) Reclamações por avaria/extravio devem ser feitas em até 24 horas após a entrega (ou constatação do insucesso), com fotos e descrição. Poderemos abrir processo de apuração e solicitar informações adicionais.
6.7. Seguro (quando disponível): a Plataforma poderá oferecer opção de seguro/valor declarado adicional. As condições, coberturas e franquias serão apresentadas antes da contratação.

7) Preços, estimativas, pagamentos e repasses
7.1. Estimativas: valores exibidos antes da corrida/frete podem ser estimativas e variar conforme rota efetiva, tempo, paradas, trânsito e regras operacionais.
7.2. Meios de pagamento: Pix, cartão e/ou dinheiro, conforme disponibilidade e regras locais exibidas no app.
7.3. Taxas: a Take-me pode cobrar taxas de serviço/intermediação e taxas operacionais (ex.: cancelamento/no-show, novas tentativas de entrega, devolução), desde que apresentadas de forma clara na Plataforma antes da conclusão da solicitação e/ou no recibo.
7.4. Cartão: quando houver pagamento por cartão, o processamento é realizado por provedor de pagamento. A Take-me pode armazenar identificadores/tokens e informações de transação, mas deve evitar armazenar dados completos de cartão.

8) Cancelamentos, tempo de espera e no-show
8.1. Cancelamento pelo Usuário/Remetente:
(a) Antes da aceitação por um Motorista: em regra, sem taxa.
(b) Após a aceitação e/ou quando o Motorista já tiver se deslocado: poderá haver taxa de cancelamento para compensar tempo e deslocamento, conforme critérios exibidos antes da confirmação da solicitação.

9) Segurança, rastreamento, comunicações e internet
9.1. A Plataforma pode oferecer recursos de segurança como rastreamento em tempo real, compartilhamento de rota e canal de suporte e emergência.

10) Avaliações e conteúdo do usuário
10.1. Usuários e Motoristas podem avaliar experiências. Conteúdos ofensivos, discriminatórios, falsos ou ilegais podem ser removidos.

11) Cadastro e obrigações de Motoristas
11.1. Motoristas devem fornecer documentos verdadeiros e atualizados, manter CNH e veículo regulares, e cumprir padrões de segurança e conduta.

12) Suspensão, bloqueio e encerramento de conta
12.1. A Take-me pode suspender/bloquear/encerrar contas em caso de violação destes Termos, fraude, risco à segurança, uso abusivo ou determinação legal.

13) Propriedade intelectual
O app, marca, interface, textos, códigos e conteúdos são de titularidade da Take-me ou licenciados. É proibido copiar, modificar, distribuir, vender ou explorar comercialmente sem autorização.

14) Privacidade e proteção de dados
14.1. O tratamento de dados pessoais segue a Política de Privacidade da Take-me.
14.2. Canal de Privacidade (Encarregado/DPO): privacidade@takeme.app.br.

15) Responsabilidades e limitações
15.1. A Take-me busca manter a Plataforma estável e segura, mas pode haver falhas técnicas, indisponibilidades, limitações de cobertura e fatores externos.
15.2. O transporte é executado pelo Motorista/parceiro, e a Take-me atua como plataforma de intermediação, sem prejuízo de responsabilidades legais aplicáveis.
15.3. Nada nestes Termos limita direitos previstos no Código de Defesa do Consumidor, quando aplicável.

16) Atendimento e resolução de disputas
• Suporte: suporte@takeme.app.br
Prazo de atendimento: buscamos responder solicitações em até 2 dias úteis e concluir apurações de incidentes/reclamações em até 10 dias úteis.

17) Lei aplicável e foro
Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca de São Luís – MA, salvo se você for consumidor, hipótese em que poderá optar pelo foro do seu domicílio.

18) Alterações destes Termos
Podemos atualizar estes Termos para refletir mudanças legais, regulatórias ou operacionais. A versão vigente ficará disponível na Plataforma com data de vigência. Mudanças relevantes serão comunicadas com antecedência razoável por aviso no app e/ou pelos canais cadastrados.`;

export function TermsOfUseScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Termos de uso</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.body}>{TERMS}</Text>
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
