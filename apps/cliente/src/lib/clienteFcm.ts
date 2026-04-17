import { Platform, PermissionsAndroid } from 'react-native';
import { supabase } from './supabase';

/**
 * Android: obtém token FCM e associa ao perfil autenticado (login / Home).
 * iOS: no-op até APNs configurado no Firebase.
 */
export async function syncClienteProfileFcmToken(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const messaging = (await import('@react-native-firebase/messaging')).default;
    if (typeof Platform.Version === 'number' && Platform.Version >= 33) {
      const status = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      if (status !== PermissionsAndroid.RESULTS.GRANTED) return;
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user?.id) return;
    const token = await messaging().getToken();
    if (!token) return;
    const { error } = await supabase.rpc('upsert_profile_fcm_token', {
      p_fcm_token: token,
      p_platform: 'android',
      p_app_slug: 'cliente',
    });
    if (error) console.warn('upsert_profile_fcm_token', error.message);
  } catch (e) {
    console.warn('syncClienteProfileFcmToken', e);
  }
}

/** Remove vínculo do token atual no Supabase e invalida token local (logout). */
export async function unregisterClienteProfileFcmToken(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const messaging = (await import('@react-native-firebase/messaging')).default;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user?.id) return;
    const token = await messaging().getToken();
    if (token) {
      await supabase
        .from('profile_fcm_tokens')
        .delete()
        .eq('profile_id', session.user.id)
        .eq('fcm_token', token);
    }
    await messaging().deleteToken();
  } catch (e) {
    console.warn('unregisterClienteProfileFcmToken', e);
  }
}
