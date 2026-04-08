import type { NavigationProp, ParamListBase } from '@react-navigation/native';

type ThreadParams = {
  conversationId: string;
  participantName?: string;
  participantAvatar?: string | null;
};

/**
 * A partir de uma tela dentro de ColetasExcursoesStack → o pai direto é o tab `MainTabsExcursoes`
 * (não o stack raiz). Dois `getParent()` apontavam para o navigator errado e quebravam `navigate('ChatExc', ...)`.
 */
export function navigateExcursionTabToChatThread(
  navigation: NavigationProp<ParamListBase>,
  params: ThreadParams,
): void {
  const tabNav = navigation.getParent();
  if (!tabNav?.navigate) {
    return;
  }
  tabNav.navigate('ChatExc', {
    screen: 'ChatExcThread',
    params: {
      conversationId: params.conversationId,
      participantName: params.participantName,
      participantAvatar: params.participantAvatar ?? undefined,
    },
  });
}
