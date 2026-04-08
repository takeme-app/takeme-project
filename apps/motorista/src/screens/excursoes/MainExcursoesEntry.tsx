import { useCallback, useEffect, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { supabase } from '../../lib/supabase';
import {
  hasSeenPreparadorExcursaoWelcome,
  markPreparadorExcursaoWelcomeSeen,
} from '../../lib/preparadorExcursaoWelcome';
import { MainTabsExcursoes } from '../../navigation/MainTabsExcursoes';
import {
  MainExcursoesBootPlaceholder,
  PreparadorExcursaoWelcomeScreen,
} from './PreparadorExcursaoWelcomeScreen';

export function MainExcursoesEntry() {
  const { height } = useWindowDimensions();
  const [phase, setPhase] = useState<'boot' | 'welcome' | 'main'>('boot');

  const resolve = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const uid = user?.id;
    if (!uid) {
      setPhase('main');
      return;
    }
    const seen = await hasSeenPreparadorExcursaoWelcome(uid);
    setPhase(seen ? 'main' : 'welcome');
  }, []);

  useEffect(() => {
    void resolve();
  }, [resolve]);

  const onContinue = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      await markPreparadorExcursaoWelcomeSeen(user.id);
    }
    setPhase('main');
  }, []);

  if (phase === 'boot') {
    return <MainExcursoesBootPlaceholder height={height} />;
  }
  if (phase === 'welcome') {
    return <PreparadorExcursaoWelcomeScreen onContinue={onContinue} />;
  }
  return <MainTabsExcursoes />;
}
