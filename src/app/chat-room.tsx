import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useMessages } from '../hooks/useData';
import {
  markMessagesRead, submitReport, toggleMeetingConfirmation,
  toggleDatingCompletion, getMatchDetail,
} from '../services/api';
import { supabase } from '../lib/supabase';
import type { Message, MatchDetail } from '../services/api';

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

  // 매치 상세 상태
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [matchDetail, setMatchDetail] = useState<MatchDetail | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadMatchDetail = useCallback(async () => {
    if (!chatId) return;
    const detail = await getMatchDetail(chatId);
    setMatchDetail(detail);
  }, [chatId]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setMyUserId(user.id);
    });
    loadMatchDetail();
  }, [loadMatchDetail]);

  // matches 테이블 변경 Realtime 구독 (약속확인/완료 상태 실시간 반영)
  useEffect(() => {
    if (!chatId) return;
    const ch = supabase
      .channel(`match_detail:${chatId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${chatId}` },
        (payload) => {
          const updated = payload.new as Record<string, unknown>;
          setMatchDetail(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              status: (updated.status as string) ?? prev.status,
              meetingConfirmedBy: (updated.meeting_confirmed_by as string[]) ?? prev.meetingConfirmedBy,
              datingCompletedBy: (updated.dating_completed_by as string[]) ?? prev.datingCompletedBy,
            };
          });
          // 모두 완료 확인하면 자동 종료 알림
          if (updated.status === 'completed') {
            Alert.alert('과팅 완료!', '모든 팀원이 과팅 완료를 확인했어요. 즐거운 시간이었나요?', [
              { text: '확인', onPress: () => router.back() },
            ]);
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [chatId]);

  useEffect(() => {
    if (chatId) markMessagesRead(chatId);
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

  const handleMeetingConfirm = async () => {
    if (!myUserId || actionLoading) return;
    setActionLoading(true);
    try {
      await toggleMeetingConfirmation(chatId);
      await loadMatchDetail();
    } catch (e) {
      Alert.alert('오류', String(e));
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!myUserId || actionLoading || !matchDetail) return;
    const alreadyConfirmed = matchDetail.datingCompletedBy.includes(myUserId);
    const remaining = matchDetail.totalMembers - matchDetail.datingCompletedBy.length;

    if (alreadyConfirmed) {
      Alert.alert('완료 신청 취소', '과팅 완료 신청을 취소할까요?', [
        { text: '아니요', style: 'cancel' },
        {
          text: '취소하기',
          onPress: async () => {
            setActionLoading(true);
            try {
              await toggleDatingCompletion(chatId);
              await loadMatchDetail();
            } catch (e) { Alert.alert('오류', String(e)); }
            finally { setActionLoading(false); }
          },
        },
      ]);
      return;
    }

    Alert.alert(
      '과팅 완료 신청',
      remaining <= 1
        ? '모든 팀원이 완료를 누르면 채팅이 종료돼요. 완료를 신청할까요?'
        : `현재 ${matchDetail.datingCompletedBy.length}/${matchDetail.totalMembers}명이 신청했어요.\n나머지 ${remaining - 1}명도 확인하면 채팅이 종료돼요.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '완료 신청',
          onPress: async () => {
            setActionLoading(true);
            try {
              const result = await toggleDatingCompletion(chatId);
              if (result.count >= result.total) {
                // 완료 처리는 DB 트리거/함수가 담당, Realtime으로 수신
              } else {
                await loadMatchDetail();
              }
            } catch (e) { Alert.alert('오류', String(e)); }
            finally { setActionLoading(false); }
          },
        },
      ],
    );
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

  const isMeetingConfirmed = myUserId ? (matchDetail?.meetingConfirmedBy ?? []).includes(myUserId) : false;
  const isDatingConfirmed = myUserId ? (matchDetail?.datingCompletedBy ?? []).includes(myUserId) : false;
  const isCompleted = matchDetail?.status === 'completed';

  const meetingCount = matchDetail?.meetingConfirmedBy.length ?? 0;
  const datingCount = matchDetail?.datingCompletedBy.length ?? 0;
  const totalMembers = matchDetail?.totalMembers ?? 0;

  const renderMessage = ({ item }: { item: Message }) => {
    if (item.sender === 'bot') {
      return (
        <View style={styles.botMsgContainer}>
          <Text style={styles.botMsg}>{item.text}</Text>
        </View>
      );
    }

    const isMe = item.sender === 'me';
    const unreadCount = isMe && totalMembers > 0
      ? Math.max(0, totalMembers - (item.readCount ?? 1))
      : 0;

    return (
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
        {!isMe && (
          <View style={styles.msgAvatar}>
            <Text style={styles.msgAvatarText}>{(name ?? '팀')[0]}</Text>
          </View>
        )}
        <View style={[styles.bubbleWrap, isMe && styles.bubbleWrapMe]}>
          {isMe && unreadCount > 0 && (
            <Text style={styles.unreadCount}>{unreadCount}</Text>
          )}
          <View style={[styles.msgBubble, isMe && styles.msgBubbleMe, item.isMyTeam && styles.msgBubbleTeam]}>
            {!isMe && item.senderName && (
              <Text style={styles.senderName}>{item.senderName}</Text>
            )}
            <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{item.text}</Text>
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
      {/* 헤더 */}
      <View style={[styles.header, { marginTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="chevron-left" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerName} numberOfLines={1}>{name}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setReportVisible(true)}>
            <Feather name="alert-circle" size={18} color="#6a7282" />
          </TouchableOpacity>
          {!isCompleted && (
            <TouchableOpacity
              style={[styles.completeBtn, isDatingConfirmed && styles.completeBtnActive]}
              onPress={handleComplete}
              disabled={actionLoading}
            >
              {actionLoading
                ? <ActivityIndicator size="small" color={isDatingConfirmed ? '#fff' : '#374151'} />
                : <Text style={[styles.completeBtnText, isDatingConfirmed && styles.completeBtnTextActive]}>
                    {isDatingConfirmed ? '완료 신청됨' : '완료'}
                  </Text>
              }
            </TouchableOpacity>
          )}
          {isCompleted && (
            <View style={styles.completedBadge}>
              <Text style={styles.completedBadgeText}>종료됨</Text>
            </View>
          )}
        </View>
      </View>

      {/* 상태 배너: 약속 확인 + 완료 현황 */}
      {!isCompleted && totalMembers > 0 && (
        <View style={styles.statusBar}>
          <TouchableOpacity
            style={[styles.statusChip, isMeetingConfirmed && styles.statusChipActive]}
            onPress={handleMeetingConfirm}
            disabled={actionLoading}
          >
            <Feather name="calendar" size={12} color={isMeetingConfirmed ? '#10b981' : '#6a7282'} />
            <Text style={[styles.statusChipText, isMeetingConfirmed && styles.statusChipTextActive]}>
              약속확인 {meetingCount}/{totalMembers}
            </Text>
          </TouchableOpacity>

          <View style={styles.statusChip}>
            <Feather name="check-circle" size={12} color={datingCount > 0 ? '#000' : '#6a7282'} />
            <Text style={[styles.statusChipText, datingCount > 0 && { color: '#000' }]}>
              완료신청 {datingCount}/{totalMembers}
            </Text>
          </View>
        </View>
      )}

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

      {/* 신고 모달 */}
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
                style={[styles.modalSubmitBtn, (!reportText.trim() || reporting) && styles.btnDisabled]}
                onPress={handleReport}
                disabled={!reportText.trim() || reporting}
              >
                {reporting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalSubmitText}>신고하기</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 입력창 */}
      {!isCompleted && (
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
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Feather name="send" size={18} color="#fff" />
            }
          </TouchableOpacity>
        </View>
      )}

      {isCompleted && (
        <View style={[styles.completedBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Text style={styles.completedBarText}>종료된 과팅이에요</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    height: 56, paddingHorizontal: 8, flexDirection: 'row',
    alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  backBtn: { padding: 8 },
  headerName: { flex: 1, fontSize: 16, fontWeight: '700', color: '#0a0a0a', marginHorizontal: 4 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerBtn: { padding: 8 },
  completeBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100,
    backgroundColor: '#f3f4f6', marginRight: 4,
  },
  completeBtnActive: { backgroundColor: '#000' },
  completeBtnText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  completeBtnTextActive: { color: '#fff' },
  completedBadge: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100,
    backgroundColor: '#f3f4f6', marginRight: 4,
  },
  completedBadgeText: { fontSize: 12, color: '#99a1af', fontWeight: '600' },
  statusBar: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6', backgroundColor: '#fafafa',
  },
  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#f3f4f6', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5,
  },
  statusChipActive: { backgroundColor: '#d1fae5' },
  statusChipText: { fontSize: 12, color: '#6a7282', fontWeight: '500' },
  statusChipTextActive: { color: '#10b981', fontWeight: '700' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  messageList: { paddingHorizontal: 12, paddingVertical: 12, gap: 6 },
  botMsgContainer: {
    backgroundColor: '#f3f4f6', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10,
    marginVertical: 8, alignSelf: 'center', maxWidth: '85%',
  },
  botMsg: { fontSize: 13, color: '#6a7282', textAlign: 'center', lineHeight: 20 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginVertical: 2 },
  msgRowMe: { justifyContent: 'flex-end' },
  msgAvatar: {
    width: 32, height: 32, backgroundColor: '#000', borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  msgAvatarText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  bubbleWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, maxWidth: '75%' },
  bubbleWrapMe: { flexDirection: 'row-reverse' },
  unreadCount: { fontSize: 11, color: '#f59e0b', fontWeight: '700', alignSelf: 'flex-end', marginBottom: 4 },
  msgBubble: {
    backgroundColor: '#f3f4f6', borderRadius: 18, borderBottomLeftRadius: 4,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  msgBubbleMe: { backgroundColor: '#000', borderBottomLeftRadius: 18, borderBottomRightRadius: 4 },
  msgBubbleTeam: { backgroundColor: '#e8f4fd' },
  senderName: { fontSize: 11, fontWeight: '600', color: '#6a7282', marginBottom: 3 },
  msgText: { fontSize: 15, color: '#0a0a0a', lineHeight: 22 },
  msgTextMe: { color: '#fff' },
  msgTime: { fontSize: 10, color: '#9ca3af', marginTop: 3, textAlign: 'right' },
  msgTimeMe: { color: 'rgba(255,255,255,0.5)' },
  inputContainer: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 12, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: '#f3f4f6', gap: 8,
  },
  textInput: {
    flex: 1, backgroundColor: '#f3f4f6', borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: '#0a0a0a', maxHeight: 100,
  },
  sendBtn: {
    width: 40, height: 40, backgroundColor: '#000', borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#d1d5db' },
  completedBar: {
    paddingTop: 14, paddingBottom: 14, alignItems: 'center',
    borderTopWidth: 1, borderTopColor: '#f3f4f6', backgroundColor: '#fafafa',
  },
  completedBarText: { fontSize: 13, color: '#99a1af' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0a0a0a', marginBottom: 6 },
  modalSub: { fontSize: 13, color: '#6a7282', marginBottom: 16 },
  modalInput: {
    backgroundColor: '#f3f4f6', borderRadius: 14, padding: 14,
    fontSize: 14, color: '#0a0a0a', minHeight: 100, textAlignVertical: 'top', marginBottom: 16,
  },
  modalBtns: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#f3f4f6', alignItems: 'center' },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: '#6a7282' },
  modalSubmitBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#000', alignItems: 'center' },
  modalSubmitText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  btnDisabled: { backgroundColor: '#d1d5db' },
});
