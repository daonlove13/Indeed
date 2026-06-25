import { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useMessages } from '../hooks/useData';
import { markMessagesRead, completeChat, submitReport } from '../services/api';
import type { Message } from '../services/api';

export default function ChatRoomPage() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const chatId = id ?? '';
  const { messages, loading, send } = useMessages(chatId);
  const insets = useSafeAreaInsets();
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reporting, setReporting] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (chatId) {
      markMessagesRead(chatId);
    }
  }, [chatId]);

  const handleSend = async () => {
    if (!inputText.trim() || sending) return;
    const text = inputText.trim();
    setInputText('');
    setSending(true);
    try {
      await send({ text, sender: 'me', time: '' });
    } finally {
      setSending(false);
    }
  };

  const handleComplete = () => {
    Alert.alert('과팅 완료', '과팅을 완료 처리할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '완료',
        onPress: async () => {
          await completeChat(chatId);
          router.back();
        },
      },
    ]);
  };

  const handleReport = async () => {
    if (!reportText.trim()) return;
    setReporting(true);
    try {
      await submitReport(chatId, reportText.trim());
      setReportVisible(false);
      setReportText('');
      Alert.alert('신고 완료', '신고가 접수됐어요. 검토 후 조치할게요.');
    } catch (e) {
      Alert.alert('오류', String(e));
    } finally {
      setReporting(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    if (item.sender === 'bot') {
      return (
        <View style={styles.botMsgContainer}>
          <Text style={styles.botMsg}>{item.text}</Text>
        </View>
      );
    }

    const isMe = item.sender === 'me';
    return (
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
        {!isMe && (
          <View style={styles.msgAvatar}>
            <Text style={styles.msgAvatarText}>{(name ?? '팀')[0]}</Text>
          </View>
        )}
        <View style={[styles.msgBubble, isMe && styles.msgBubbleMe, item.isMyTeam && styles.msgBubbleTeam]}>
          {!isMe && item.senderName && (
            <Text style={styles.senderName}>{item.senderName}</Text>
          )}
          <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{item.text}</Text>
          <View style={styles.msgMeta}>
            <Text style={[styles.msgTime, isMe && styles.msgTimeMe]}>{item.time}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.header, { marginTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="chevron-left" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerName} numberOfLines={1}>{name}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.moreBtn} onPress={() => setReportVisible(true)}>
            <Feather name="alert-circle" size={18} color="#6a7282" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.moreBtn} onPress={handleComplete}>
            <Text style={styles.moreText}>완료</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.dbId ?? String(item.id)}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
      )}

      <Modal visible={reportVisible} transparent animationType="slide" onRequestClose={() => setReportVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>신고하기</Text>
            <Text style={styles.modalSub}>채팅 내 부적절한 행동을 신고해주세요.</Text>
            <TextInput
              style={styles.modalInput}
              value={reportText}
              onChangeText={setReportText}
              placeholder="신고 사유를 입력해주세요"
              placeholderTextColor="#99a1af"
              multiline
              maxLength={300}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setReportVisible(false); setReportText(''); }}>
                <Text style={styles.modalCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, (!reportText.trim() || reporting) && styles.ctaBtnDisabled]}
                onPress={handleReport}
                disabled={!reportText.trim() || reporting}
              >
                {reporting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalSubmitText}>신고하기</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder="메시지 입력..."
          placeholderTextColor="#99a1af"
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Feather name="send" size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    height: 56,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backBtn: { padding: 8 },
  headerName: { flex: 1, fontSize: 16, fontWeight: '700', color: '#0a0a0a', marginHorizontal: 8 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  moreBtn: { paddingHorizontal: 10, paddingVertical: 8 },
  moreText: { fontSize: 14, color: '#6a7282' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0a0a0a', marginBottom: 6 },
  modalSub: { fontSize: 13, color: '#6a7282', marginBottom: 16 },
  modalInput: {
    backgroundColor: '#f3f4f6', borderRadius: 14, padding: 14,
    fontSize: 14, color: '#0a0a0a', minHeight: 100, textAlignVertical: 'top', marginBottom: 16,
  },
  modalBtns: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    backgroundColor: '#f3f4f6', alignItems: 'center',
  },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: '#6a7282' },
  modalSubmitBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#000', alignItems: 'center' },
  modalSubmitText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  ctaBtnDisabled: { backgroundColor: '#d1d5db' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  messageList: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  botMsgContainer: {
    backgroundColor: '#f3f4f6',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginVertical: 8,
    alignSelf: 'center',
    maxWidth: '85%',
  },
  botMsg: { fontSize: 13, color: '#6a7282', textAlign: 'center', lineHeight: 20 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginVertical: 2 },
  msgRowMe: { justifyContent: 'flex-end' },
  msgAvatar: {
    width: 32, height: 32, backgroundColor: '#000', borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  msgAvatarText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  msgBubble: {
    maxWidth: '70%',
    backgroundColor: '#f3f4f6',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  msgBubbleMe: {
    backgroundColor: '#000',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 4,
  },
  msgBubbleTeam: {
    backgroundColor: '#e8f4fd',
  },
  senderName: { fontSize: 11, fontWeight: '600', color: '#6a7282', marginBottom: 4 },
  msgText: { fontSize: 15, color: '#0a0a0a', lineHeight: 22 },
  msgTextMe: { color: '#fff' },
  msgMeta: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
  msgTime: { fontSize: 11, color: '#9ca3af' },
  msgTimeMe: { color: 'rgba(255,255,255,0.6)' },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0a0a0a',
    maxHeight: 100,
  },
  sendBtn: {
    width: 40, height: 40, backgroundColor: '#000', borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#d1d5db' },
});
