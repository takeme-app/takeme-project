import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Text } from '../components/Text';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList, ChatExcStackParamList } from '../navigation/types';
import { supabase } from '../lib/supabase';

const sb = supabase as { from: (table: string) => any };
import { storageUrl } from '../utils/storageUrl';

type Props =
  | NativeStackScreenProps<ProfileStackParamList, 'Chat'>
  | NativeStackScreenProps<ChatExcStackParamList, 'ChatExcThread'>;

const GOLD = '#C9A227';

const COLORS = {
  background: '#FFFFFF',
  black: '#0d0d0d',
  neutral100: '#F3F4F6',
  neutral300: '#f1f1f1',
  neutral700: '#767676',
  bubbleOut: GOLD,
  bubbleIn: '#F3F4F6',
};

type Message = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function groupByDate(messages: Message[]): Array<Message | { type: 'separator'; date: string; id: string }> {
  const result: Array<Message | { type: 'separator'; date: string; id: string }> = [];
  let lastDate = '';
  for (const msg of messages) {
    const dateLabel = formatDateLabel(msg.created_at);
    if (dateLabel !== lastDate) {
      result.push({ type: 'separator', date: dateLabel, id: `sep-${msg.id}` });
      lastDate = dateLabel;
    }
    result.push(msg);
  }
  return result;
}

export function ChatScreen({ navigation, route }: Props) {
  const { conversationId, participantName, participantAvatar } = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [conversationStatus, setConversationStatus] = useState<'active' | 'closed'>('active');
  const [myId, setMyId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setMyId(user.id);
    });
  }, []);

  const loadMessages = useCallback(async () => {
    const { data } = await sb
      .from('messages')
      .select('id, sender_id, content, created_at, read_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    setMessages((data ?? []) as Message[]);
    setLoading(false);
  }, [conversationId]);

  const loadConversation = useCallback(async () => {
    const { data } = await sb
      .from('conversations')
      .select('status')
      .eq('id', conversationId)
      .single();
    if (data?.status) setConversationStatus(data.status as 'active' | 'closed');
  }, [conversationId]);

  useEffect(() => {
    loadMessages();
    loadConversation();

    // Realtime subscription
    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.find((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId, loadMessages, loadConversation]);

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || sending || !myId) return;
    setSending(true);
    setInputText('');
    await sb.from('messages').insert({
      conversation_id: conversationId,
      sender_id: myId,
      content: text,
    });
    setSending(false);
  };

  const items = groupByDate(messages);

  const renderItem = ({ item }: { item: typeof items[number] }) => {
    if ('type' in item && item.type === 'separator') {
      return (
        <View style={styles.separatorRow}>
          <View style={styles.separatorPill}>
            <Text style={styles.separatorText}>{item.date}</Text>
          </View>
        </View>
      );
    }
    const msg = item as Message;
    const isOutgoing = msg.sender_id === myId;
    return (
      <View style={[styles.messageRow, isOutgoing ? styles.messageRowOut : styles.messageRowIn]}>
        <View style={[styles.bubble, isOutgoing ? styles.bubbleOut : styles.bubbleIn]}>
          <Text style={[styles.bubbleText, isOutgoing && styles.bubbleTextOut]}>{msg.content}</Text>
          <View style={styles.bubbleFooter}>
            <Text style={[styles.bubbleTime, isOutgoing && styles.bubbleTimeOut]}>
              {formatTime(msg.created_at)}
            </Text>
            {isOutgoing && (
              <MaterialIcons
                name={msg.read_at ? 'done-all' : 'done'}
                size={14}
                color={msg.read_at ? '#1D4ED8' : 'rgba(0,0,0,0.45)'}
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBack} onPress={() => navigation.goBack()} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={24} color={COLORS.black} />
        </TouchableOpacity>
        {participantAvatar ? (
          <Image source={{ uri: storageUrl('avatars', participantAvatar) ?? '' }} style={styles.headerAvatar} />
        ) : (
          <View style={styles.headerAvatarPlaceholder}>
            <Text style={styles.headerAvatarText}>
              {(participantName ?? '?')[0].toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={styles.headerName} numberOfLines={1}>{participantName ?? 'Usuário'}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={GOLD} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={items}
            keyExtractor={(item) => ('id' in item ? item.id : (item as any).id)}
            renderItem={renderItem}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            ListFooterComponent={
              conversationStatus === 'closed' ? (
                <Text style={styles.closedText}>Conversa encerrada</Text>
              ) : null
            }
          />
        )}

        {conversationStatus === 'active' && (
          <View style={styles.inputRow}>
            <TouchableOpacity style={styles.inputAction}>
              <MaterialIcons name="add" size={26} color={COLORS.neutral700} />
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder="Pesquisar"
              placeholderTextColor={COLORS.neutral700}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
              onSubmitEditing={sendMessage}
            />
            <TouchableOpacity
              style={[styles.sendButton, (!inputText.trim() || sending || !myId) && styles.sendButtonDisabled]}
              onPress={sendMessage}
              disabled={!inputText.trim() || sending || !myId}
              activeOpacity={0.8}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <MaterialIcons name="send" size={20} color="#FFFFFF" />
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.inputAction}>
              <MaterialIcons name="camera-alt" size={24} color={COLORS.neutral700} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.inputAction}>
              <MaterialIcons name="mic" size={24} color={COLORS.neutral700} />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral300,
  },
  headerBack: { padding: 8 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, marginLeft: 4 },
  headerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: GOLD,
    marginLeft: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  headerName: { flex: 1, fontSize: 17, fontWeight: '600', color: COLORS.black, marginLeft: 10 },
  headerSpacer: { width: 40 },

  messagesContent: { padding: 16, paddingBottom: 8 },

  separatorRow: { alignItems: 'center', marginVertical: 12 },
  separatorPill: {
    backgroundColor: COLORS.neutral100,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  separatorText: { fontSize: 12, color: COLORS.neutral700 },

  messageRow: { marginBottom: 10 },
  messageRowOut: { alignItems: 'flex-end' },
  messageRowIn: { alignItems: 'flex-start' },

  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  bubbleOut: {
    backgroundColor: COLORS.bubbleOut,
    borderBottomRightRadius: 4,
  },
  bubbleIn: {
    backgroundColor: COLORS.bubbleIn,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 15, color: COLORS.black, lineHeight: 20 },
  bubbleTextOut: { color: COLORS.black },
  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
  bubbleTime: { fontSize: 11, color: COLORS.neutral700 },
  bubbleTimeOut: { color: 'rgba(0,0,0,0.55)' },

  closedText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.black,
    paddingVertical: 24,
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.neutral300,
    backgroundColor: COLORS.background,
    gap: 4,
  },
  inputAction: { padding: 6 },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: COLORS.neutral300,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: COLORS.black,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { opacity: 0.4 },
});
