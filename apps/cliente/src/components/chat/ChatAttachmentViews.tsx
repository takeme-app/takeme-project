import { useState, useEffect, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Text } from '../Text';
import { chatAttachmentSignedUrl } from '../../utils/storageUrl';

const GOLD = '#C9A227';

type Props = {
  attachmentPath: string;
  isOutgoing: boolean;
  outgoingPalette?: 'gold' | 'dark';
};

export function ChatAttachmentImage({ attachmentPath, isOutgoing, outgoingPalette = 'gold' }: Props) {
  const [uri, setUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const darkOut = isOutgoing && outgoingPalette === 'dark';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    chatAttachmentSignedUrl(attachmentPath).then((u) => {
      if (!cancelled) {
        setUri(u);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [attachmentPath]);

  if (loading) {
    return (
      <View style={[styles.mediaBox, isOutgoing && styles.mediaBoxOut]}>
        <ActivityIndicator color={darkOut ? '#FFFFFF' : isOutgoing ? '#111827' : GOLD} />
      </View>
    );
  }
  if (!uri) {
    return (
      <Text style={[styles.fallbackText, isOutgoing && styles.fallbackTextOut, darkOut && styles.fallbackTextDarkOut]}>
        Não foi possível carregar a imagem.
      </Text>
    );
  }
  return (
    <Image source={{ uri }} style={styles.chatImage} resizeMode="cover" />
  );
}

export function ChatAttachmentAudio({ attachmentPath, isOutgoing, outgoingPalette = 'gold' }: Props) {
  const [uri, setUri] = useState<string | null>(null);
  const darkOut = isOutgoing && outgoingPalette === 'dark';

  useEffect(() => {
    let cancelled = false;
    chatAttachmentSignedUrl(attachmentPath).then((u) => {
      if (!cancelled) setUri(u);
    });
    return () => { cancelled = true; };
  }, [attachmentPath]);

  const open = useCallback(async () => {
    if (uri) await Linking.openURL(uri);
  }, [uri]);

  return (
    <TouchableOpacity
      style={[styles.audioRow, isOutgoing && styles.audioRowOut]}
      onPress={open}
      disabled={!uri}
      activeOpacity={0.8}
    >
      <MaterialIcons
        name="graphic-eq"
        size={36}
        color={darkOut ? '#FFFFFF' : isOutgoing ? '#111827' : GOLD}
      />
      <Text style={[styles.audioLabel, isOutgoing && styles.audioLabelOut, darkOut && styles.audioLabelDarkOut]}>
        {uri ? 'Abrir áudio' : 'Carregando…'}
      </Text>
    </TouchableOpacity>
  );
}

export function ChatAttachmentFile({
  attachmentPath,
  contentLabel,
  isOutgoing,
  outgoingPalette = 'gold',
}: Props & { contentLabel: string }) {
  const darkOut = isOutgoing && outgoingPalette === 'dark';
  const open = useCallback(async () => {
    const url = await chatAttachmentSignedUrl(attachmentPath);
    if (url) await Linking.openURL(url);
  }, [attachmentPath]);

  return (
    <TouchableOpacity
      style={[styles.fileRow, isOutgoing && styles.fileRowOut]}
      onPress={open}
      activeOpacity={0.8}
    >
      <MaterialIcons
        name="insert-drive-file"
        size={28}
        color={darkOut ? '#FFFFFF' : isOutgoing ? '#111827' : '#374151'}
      />
      <Text style={[styles.fileLabel, isOutgoing && styles.fileLabelOut, darkOut && styles.fileLabelDarkOut]} numberOfLines={2}>
        {contentLabel}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  mediaBox: {
    minWidth: 160,
    minHeight: 100,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  mediaBoxOut: { backgroundColor: 'rgba(0,0,0,0.08)' },
  chatImage: {
    width: 220,
    maxWidth: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
  fallbackText: { fontSize: 14, color: '#6B7280' },
  fallbackTextOut: { color: 'rgba(0,0,0,0.65)' },
  fallbackTextDarkOut: { color: 'rgba(255,255,255,0.85)' },
  audioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  audioRowOut: {},
  audioLabel: { fontSize: 15, fontWeight: '600', color: '#374151' },
  audioLabelOut: { color: '#111827' },
  audioLabelDarkOut: { color: '#FFFFFF' },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: 220,
    paddingVertical: 4,
  },
  fileRowOut: {},
  fileLabel: { fontSize: 14, color: '#374151', flex: 1 },
  fileLabelOut: { color: '#111827' },
  fileLabelDarkOut: { color: '#FFFFFF' },
});
