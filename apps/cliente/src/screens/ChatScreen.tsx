import { useState } from 'react';
import {
  View,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text } from '../components/Text';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ActivitiesStackParamList } from '../navigation/ActivitiesStackTypes';

type Props = NativeStackScreenProps<ActivitiesStackParamList, 'Chat'>;

const COLORS = {
  background: '#FFFFFF',
  black: '#0d0d0d',
  neutral300: '#f1f1f1',
  neutral700: '#767676',
  bubbleOut: '#0d0d0d',
  bubbleIn: '#e2e2e2',
};

type Message = {
  id: string;
  text: string;
  isOutgoing: boolean;
  time: string;
  date?: string;
  read?: boolean;
};

const MOCK_MESSAGES: Message[] = [
  { id: '1', text: 'Olá! Sua viagem foi confirmada.', isOutgoing: false, time: '14:30', date: 'Hoje' },
  { id: '2', text: 'Obrigado! A que horas o motorista chega?', isOutgoing: true, time: '14:32', read: true },
  { id: '3', text: 'Em aproximadamente 15 minutos.', isOutgoing: false, time: '14:33' },
];

export function ChatScreen({ navigation, route }: Props) {
  const contactName = route.params?.contactName ?? 'Suporte Take Me';
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [conversationEnded] = useState(false);

  const sendMessage = () => {
    const t = inputText.trim();
    if (!t) return;
    setMessages((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        text: t,
        isOutgoing: true,
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        read: false,
      },
    ]);
    setInputText('');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBack} onPress={() => navigation.goBack()} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={24} color={COLORS.black} />
        </TouchableOpacity>
        <View style={styles.headerAvatar} />
        <Text style={styles.headerName} numberOfLines={1}>{contactName}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {conversationEnded && (
        <View style={styles.endedBanner}>
          <Text style={styles.endedBannerText}>Conversa encerrada</Text>
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          style={styles.messagesScroll}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg) => (
            <View
              key={msg.id}
              style={[styles.messageRow, msg.isOutgoing ? styles.messageRowOut : styles.messageRowIn]}
            >
              {msg.date && (
                <Text style={styles.messageDate}>{msg.date}</Text>
              )}
              <View style={[styles.bubble, msg.isOutgoing ? styles.bubbleOut : styles.bubbleIn]}>
                <Text style={[styles.bubbleText, msg.isOutgoing && styles.bubbleTextOut]}>{msg.text}</Text>
                <View style={styles.bubbleFooter}>
                  <Text style={[styles.bubbleTime, msg.isOutgoing && styles.bubbleTimeOut]}>{msg.time}</Text>
                  {msg.isOutgoing && (
                    <MaterialIcons
                      name={msg.read ? 'done-all' : 'done'}
                      size={14}
                      color={msg.read ? '#2563EB' : COLORS.neutral700}
                    />
                  )}
                </View>
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.inputRow}>
          <TouchableOpacity style={styles.inputAction} onPress={() => {}}>
            <MaterialIcons name="attach-file" size={24} color={COLORS.neutral700} />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Mensagem"
            placeholderTextColor={COLORS.neutral700}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            editable={!conversationEnded}
          />
          <TouchableOpacity style={styles.inputAction} onPress={() => {}}>
            <MaterialIcons name="camera-alt" size={24} color={COLORS.neutral700} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.inputAction} onPress={() => {}}>
            <MaterialIcons name="mic" size={24} color={COLORS.neutral700} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!inputText.trim() || conversationEnded}
            activeOpacity={0.8}
          >
            <MaterialIcons name="send" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral300,
  },
  headerBack: { padding: 8 },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.neutral300,
    marginLeft: 4,
  },
  headerName: { flex: 1, fontSize: 18, fontWeight: '600', color: COLORS.black, marginLeft: 12 },
  headerSpacer: { width: 40 },
  endedBanner: {
    backgroundColor: COLORS.neutral300,
    paddingVertical: 8,
    alignItems: 'center',
  },
  endedBannerText: { fontSize: 13, color: COLORS.neutral700 },
  messagesScroll: { flex: 1 },
  messagesContent: { padding: 16, paddingBottom: 24 },
  messageRow: { marginBottom: 12 },
  messageRowOut: { alignItems: 'flex-end' },
  messageRowIn: { alignItems: 'flex-start' },
  messageDate: {
    alignSelf: 'center',
    fontSize: 12,
    color: COLORS.neutral700,
    marginBottom: 8,
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderBottomRightRadius: 4,
  },
  bubbleOut: {
    backgroundColor: COLORS.bubbleOut,
    borderBottomRightRadius: 4,
    borderBottomLeftRadius: 16,
  },
  bubbleIn: {
    backgroundColor: COLORS.bubbleIn,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 16,
  },
  bubbleText: { fontSize: 15, color: COLORS.black },
  bubbleTextOut: { color: '#FFFFFF' },
  bubbleFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4 },
  bubbleTime: { fontSize: 11, color: COLORS.neutral700 },
  bubbleTimeOut: { color: 'rgba(255,255,255,0.8)' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.neutral300,
    backgroundColor: COLORS.background,
  },
  inputAction: { padding: 8 },
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
    marginHorizontal: 4,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { opacity: 0.5 },
});
