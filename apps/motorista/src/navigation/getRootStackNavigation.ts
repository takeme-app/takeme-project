import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import type { RootStackParamList } from './types';

/** Do ProfileStack (aba Perfil), sobe até o navigator raiz (Welcome, Main, ForgotPassword, …). */
export function getRootStackNavigation(
  navigation: NavigationProp<ParamListBase>
): NavigationProp<RootStackParamList> | undefined {
  const tabNav = navigation.getParent();
  const root = tabNav?.getParent();
  return root as NavigationProp<RootStackParamList> | undefined;
}
