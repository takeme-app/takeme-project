import type { EdgeInsets } from 'react-native-safe-area-context';

/** Altura fixa da área de conteúdo (ícone + rótulo) — alinhado a `MainTabs`. */
export const MAIN_TAB_BAR_CONTENT_HEIGHT = 62;
const MIN_BOTTOM_INSET = 8;

/** Estilo da tab bar principal (Início / Serviços / Atividades / Perfil). */
export function getMainTabBarStyle(bottomInset: number) {
  const paddingBottom = Math.max(bottomInset, MIN_BOTTOM_INSET);
  const height = MAIN_TAB_BAR_CONTENT_HEIGHT + paddingBottom;
  return {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#f1f1f1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    height,
    paddingBottom,
  } as const;
}

export function getMainTabBarStyleFromInsets(insets: Pick<EdgeInsets, 'bottom'>) {
  return getMainTabBarStyle(insets.bottom);
}
