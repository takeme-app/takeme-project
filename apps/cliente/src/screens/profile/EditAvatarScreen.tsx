import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/ProfileStackTypes';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';

type Props = NativeStackScreenProps<ProfileStackParamList, 'EditAvatar'>;

const COLORS = {
  background: '#FFFFFF',
  black: '#0d0d0d',
  neutral300: '#f1f1f1',
  neutral700: '#767676',
};

const AVATAR_SIZE = 120;

export function EditAvatarScreen({ navigation }: Props) {
  const [profile, setProfile] = useState<{ avatar_url: string | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const avatarUrl = profile?.avatar_url
    ? (profile.avatar_url.startsWith('http')
        ? profile.avatar_url
        : `${supabaseUrl}/storage/v1/object/public/avatars/${profile.avatar_url}`)
    : null;

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setInitialLoading(false);
        return;
      }
      const { data } = await supabase.from('profiles').select('avatar_url').eq('id', user.id).single();
      setProfile(data ? { avatar_url: data.avatar_url } : null);
      setInitialLoading(false);
    })();
  }, []);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Permita o acesso às fotos para alterar a foto de perfil.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    if (result.canceled || !result.assets[0]?.uri) return;

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const path = `${user.id}/avatar.jpg`;
      const asset = result.assets[0];
      let body: Blob | ArrayBuffer;

      if (asset.base64) {
        const binary = atob(asset.base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        body = bytes.buffer;
      } else {
        const response = await fetch(asset.uri);
        body = await response.blob();
      }

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, body, { contentType: 'image/jpeg', upsert: true });

      if (uploadError) {
        const isBucketMissing =
          uploadError.message?.toLowerCase().includes('bucket') ||
          uploadError.message?.toLowerCase().includes('not found');
        const msg = isBucketMissing
          ? 'O bucket de fotos ainda não foi criado. No Supabase Dashboard vá em Storage > New bucket, crie um bucket com id "avatars" e marque como público.'
          : uploadError.message;
        Alert.alert('Erro ao enviar foto', msg);
        setLoading(false);
        return;
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: path, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (updateError) {
        Alert.alert('Erro', updateError.message);
        setLoading(false);
        return;
      }
      setProfile({ avatar_url: path });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Não foi possível enviar a foto.');
    }
    setLoading(false);
  };

  const removePhoto = () => {
    if (!avatarUrl) return;
    Alert.alert(
      'Remover foto',
      'Deseja remover sua foto de perfil?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
              setLoading(false);
              return;
            }
            const path = profile?.avatar_url?.startsWith('http') ? undefined : profile?.avatar_url;
            if (path) {
              await supabase.storage.from('avatars').remove([path]);
            }
            await supabase
              .from('profiles')
              .update({ avatar_url: null, updated_at: new Date().toISOString() })
              .eq('id', user.id);
            setProfile({ avatar_url: null });
            setLoading(false);
            navigation.goBack();
          },
        },
      ]
    );
  };

  if (initialLoading) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.dialog}>
        <View style={styles.headerRow}>
          <View style={styles.headerSpacer} />
          <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <MaterialIcons name="close" size={22} color={COLORS.neutral700} />
          </TouchableOpacity>
        </View>
        <Text style={styles.title}>Foto de perfil</Text>
        <Text style={styles.hint}>Toque em "Escolher foto" para enviar uma nova imagem da galeria.</Text>

      <View style={styles.avatarWrap}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>?</Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={pickImage}
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Escolher foto</Text>}
      </TouchableOpacity>

      {avatarUrl && (
        <TouchableOpacity
          style={styles.removeButton}
          onPress={removePhoto}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={styles.removeButtonText}>Remover foto</Text>
        </TouchableOpacity>
      )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  dialog: { flex: 1, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 48 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 8 },
  headerSpacer: { flex: 1 },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.neutral300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.black, marginBottom: 8 },
  hint: { fontSize: 14, color: COLORS.neutral700, marginBottom: 24 },
  avatarWrap: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 },
  avatarPlaceholder: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: COLORS.neutral300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: 48, fontWeight: '700', color: COLORS.black },
  button: {
    backgroundColor: COLORS.black,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  removeButton: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  removeButtonText: { fontSize: 16, fontWeight: '500', color: COLORS.neutral700 },
});
