import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Modal, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useMessages, broadcastChatsReload } from '../hooks/useData';
import {
  markMessagesRead, submitReport, toggleMeetingConfirmation,
  toggleDatingCompletion, getMatchDetail, updateMeetingInfo, getMatchMembers,
} from '../services/api';
import { supabase } from '../lib/supabase';
import type { Message, MatchDetail, MatchMember } from '../services/api';

export default function ChatRoomPage() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const chatId = id ?? '';
  const { messages, loading, send } = useMessages(chatId);
  const insets = useSafeAreaInsets();
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [reportStep, setReportStep] = useState<'select' | 'reason'>('select');
  const [reportTargetId, setReportTargetId] = useState('');
  const [reportTargetName, setReportTargetName] = useState('');
  const [reportText, setReportText] = useState('');
  const [reporting, setReporting] = useState(false);
  const [otherMembers, setOtherMembers] = useState<MatchMember[]>([]);
  const flatListRef = useRef<FlatList>(null);
  const prevMsgCountRef = useRef(0);

  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [matchDetail, setMatchDetail] = useState<MatchDetail | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [completeModalVisible, setCompleteModalVisible] = useState(false);
  const [completedNotifVisible, setCompletedNotifVisible] = useState(false);

  const [meetingModalVisible, setMeetingModalVisible] = useState(false);
  const [meetingPlace, setMeetingPlace] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [savingMeeting, setSavingMeeting] = useState(false);

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
    getMatchMembers(chatId).then(setOtherMembers).catch(() => {});
  }, [loadMatchDetail, chatId]);

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
              meetingPlace: (updated.meeting_place as string | null) ?? prev.meetingPlace,
              meetingDate: (updated.meeting_date as string | null) ?? prev.meetingDate,
              meetingTime: (updated.meeting_time as string | null) ?? prev.meetingTime,
            };
          });
          if (updated.status === 'completed') {
            markMessagesRead(chatId);
            setCompleteModalVisible(false);
            setCompletedNotifVisible(true);
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [chatId]);

  useEffect(() => {
    if (!chatId) return;
    markMessagesRead(chatId).then(() => broadcastChatsReload());
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

  const openMeetingModal = () => {
    setMeetingPlace(matchDetail?.meetingPlace ?? '');
    setMeetingDate(matchDetail?.meetingDate ?? '');
    setMeetingTime(matchDetail?.meetingTime ?? '');
    setMeetingModalVisible(true);
  };

  const handleSaveMeeting = async () => {
    setSavingMeeting(true);
    try {
      await updateMeetingInfo(chatId, meetingPlace.trim(), meetingDate.trim(), meetingTime.trim());
      await toggleMeetingConfirmation(chatId);
      await loadMatchDetail();
      setMeetingModalVisible(false);
    } catch (e) {
      Alert.alert('오류', String(e));
    } finally {
      setSavingMeeting(false);
    }
  };

  const doComplete = async () => {
    setActionLoading(true);
    try {
      const result = await toggleDatingCompletion(chatId);
      if (result.count < result.total) await loadMatchDetail();
    } catch (e) { Alert.alert('오류', String(e)); }
    finally { setActionLoading(false); setCompleteModalVisible(false); }
  };

  const doUncomplete = async () => {
    setActionLoading(true);
    try {
      await toggleDatingCompletion(chatId);
      await loadMatchDetail();
    } catch (e) { Alert.alert('오류', String(e)); }
    finally { setActionLoading(false); setCompleteModalVisible(false); }
  };

  const openReport = () => {
    setReportStep('select');
    setReportTargetId('');
    setReportTargetName('');
    setReportText('');
    setReportVisible(true);
  };

  const selectMember = (userId: string, memberName: string) => {
    setReportTargetId(userId);
    setReportTargetName(memberName);
    setReportStep('reason');
  };

  const handleReport = async () => {
    if (!reportText.trim() || !reportTargetId) return;
    setReporting(true);
    try {
      await submitReport(chatId, reportTargetId, reportText.trim());
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
  const remaining = totalMembers - datingCount - 1;

  const renderMessage = ({ item }: { item: Message }) => {
    if (item.sender === 'bot') {
      return (
        <View style={styles.botMsgContainer}>
          <Text style={styles.botMsg}>{item.text}</Text>
        </View>
      );
    }

    const isMe = item.sender === 'me';
    const isOwnTeam = isMe || !!item.isMyTeam;
    const unreadCount = totalMembers > 1
      ? Math.max(0, (totalMembers - 1) - (item.readCount ?? 0))
      : 0;

    return (
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
        <View style={[styles.bubbleWrap, isMe && styles.bubbleWrapMe]}>
          {isMe && unreadCount > 0 && (
            <Text style={styles.unreadCount}>{unreadCount}</Text>
          )}
          <View style={[styles.msgBubble, isOwnTeam ? styles.msgBubbleOwn : styles.msgBubbleOther]}>
            {!isMe && item.senderName && (
              <Text style={[styles.senderName, !isOwnTeam && styles.senderNameOther]}>{item.senderName}</Text>
            )}
            <Text style={[styles.msgText, isOwnTeam ? styles.msgTextOwn : styles.msgTextOther]}>{item.text}</Text>
            <Text style={[styles.msgTime, isOwnTeam ? styles.msgTimeOwn : styles.msgTimeOther]}>{item.time}</Text>
          </View>
          {!isMe && unreadCount > 0 && (
            <Text style={styles.unreadCount}>{unreadCount}</Text>
          )}
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
          <TouchableOpacity style={styles.reportBtn} onPress={openReport}>
            <Feather name="flag" size={13} color="#6a7282" />
            <Text style={styles.reportBtnText}>신고</Text>
          </TouchableOpacity>
          {!isCompleted && (
            <TouchableOpacity
              style={[styles.completeBtn, isDatingConfirmed && styles.completeBtnActive]}
              onPress={() => setCompleteModalVisible(true)}
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

      {/* 상태 배너 */}
      {!isCompleted && totalMembers > 0 && (
        <View style={styles.statusBar}>
          {(matchDetail?.meetingPlace || matchDetail?.meetingDate || matchDetail?.meetingTime) && (
            <TouchableOpacity style={styles.meetingCard} onPress={openMeetingModal}>
              <Feather name="map-pin" size={13} color="#6366f1" />
              <View style={{ flex: 1 }}>
                {matchDetail.meetingPlace ? <Text style={styles.meetingCardText}>{matchDetail.meetingPlace}</Text> : null}
                {(matchDetail.meetingDate || matchDetail.meetingTime) && (
                  <Text style={styles.meetingCardSub}>
                    {[matchDetail.meetingDate, matchDetail.meetingTime].filter(Boolean).join(' ')}
                  </Text>
                )}
              </View>
              <Feather name="edit-2" size={12} color="#6a7282" />
            </TouchableOpacity>
          )}

          <View style={styles.statusChips}>
            <TouchableOpacity
              style={[styles.statusChip, isMeetingConfirmed && styles.statusChipActive]}
              onPress={openMeetingModal}
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
          onLayout={() => {
            if (messages.length > 0) flatListRef.current?.scrollToEnd({ animated: false });
          }}
          onContentSizeChange={() => {
            const isNew = prevMsgCountRef.current > 0 && messages.length > prevMsgCountRef.current;
            flatListRef.current?.scrollToEnd({ animated: isNew });
            prevMsgCountRef.current = messages.length;
          }}
        />
      )}

      {/* 과팅 완료 알림 모달 */}
      <Modal visible={completedNotifVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBox} activeOpacity={1}>
            <Text style={styles.completedEmoji}>🎉</Text>
            <Text style={styles.completedTitle}>과팅 완료!</Text>
            <Text style={styles.completedDesc}>
              모든 팀원이 과팅 완료를 확인했어요.{'\n'}즐거운 시간이었나요?
            </Text>
            <TouchableOpacity
              style={styles.completedConfirmBtn}
              onPress={() => { setCompletedNotifVisible(false); router.back(); }}
            >
              <Text style={styles.completedConfirmText}>확인</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* 과팅 완료 신청 모달 */}
      <Modal visible={completeModalVisible} transparent animationType="slide" onRequestClose={() => setCompleteModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => !actionLoading && setCompleteModalVisible(false)}>
          <TouchableOpacity style={styles.modalBox} activeOpacity={1}>
            {isDatingConfirmed ? (
              <>
                <Text style={styles.modalTitle}>완료 신청 취소</Text>
                <Text style={styles.modalSub}>과팅 완료 신청을 취소할까요?</Text>
                <View style={styles.modalBtns}>
                  <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setCompleteModalVisible(false)}>
                    <Text style={styles.modalCancelText}>아니요</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalSubmitBtn, actionLoading && styles.btnDisabled]}
                    onPress={doUncomplete} disabled={actionLoading}
                  >
                    {actionLoading
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.modalSubmitText}>취소하기</Text>}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>과팅 완료 신청</Text>
                <View style={styles.completeInfoBox}>
                  <Text style={styles.completeCountText}>{datingCount}/{totalMembers}명 신청됨</Text>
                  <Text style={styles.completeInfoText}>
                    {remaining <= 0
                      ? '내가 신청하면 채팅이 종료돼요'
                      : `나머지 ${remaining}명도 신청하면 채팅이 종료돼요`}
                  </Text>
                </View>
                <Text style={styles.modalSub}>모든 팀원이 완료를 눌러야 채팅이 닫혀요.</Text>
                <View style={styles.modalBtns}>
                  <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setCompleteModalVisible(false)}>
                    <Text style={styles.modalCancelText}>취소</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalSubmitBtn, actionLoading && styles.btnDisabled]}
                    onPress={doComplete} disabled={actionLoading}
                  >
                    {actionLoading
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.modalSubmitText}>완료 신청</Text>}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* 신고 모달 (2단계) */}
      <Modal visible={reportVisible} transparent animationType="slide" onRequestClose={() => setReportVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            {reportStep === 'select' ? (
              <>
                <Text style={styles.modalTitle}>신고하기</Text>
                <Text style={styles.modalSub}>신고할 팀원을 선택해주세요</Text>
                {otherMembers.length === 0 ? (
                  <View style={styles.emptyMemberBox}>
                    <ActivityIndicator size="small" color="#000" />
                    <Text style={styles.emptyMemberText}>팀원 정보를 불러오는 중이에요</Text>
                  </View>
                ) : (
                  otherMembers.map(member => (
                    <TouchableOpacity
                      key={member.userId}
                      style={styles.memberSelectRow}
                      onPress={() => selectMember(member.userId, member.name)}
                    >
                      <View style={styles.memberSelectAvatar}>
                        <Text style={styles.memberSelectAvatarText}>{member.name[0] ?? '?'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.memberSelectName}>{member.name}</Text>
                        {member.department ? (
                          <Text style={styles.memberSelectDept}>{member.department}</Text>
                        ) : null}
                      </View>
                      <Feather name="chevron-right" size={16} color="#d1d5db" />
                    </TouchableOpacity>
                  ))
                )}
                <TouchableOpacity
                  style={[styles.modalCancelBtn, { marginTop: 12 }]}
                  onPress={() => setReportVisible(false)}
                >
                  <Text style={styles.modalCancelText}>취소</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.reportHeaderRow}>
                  <TouchableOpacity onPress={() => setReportStep('select')} style={{ padding: 4 }}>
                    <Feather name="chevron-left" size={20} color="#374151" />
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>{reportTargetName} 신고</Text>
                </View>
                <Text style={styles.modalSub}>신고 사유를 구체적으로 입력해주세요</Text>
                <TextInput
                  style={styles.modalInput}
                  value={reportText}
                  onChangeText={setReportText}
                  placeholder="부적절한 행동이나 발언을 입력해주세요"
                  placeholderTextColor="#99a1af"
                  multiline
                  maxLength={300}
                />
                <View style={styles.modalBtns}>
                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={() => { setReportVisible(false); setReportText(''); }}
                  >
                    <Text style={styles.modalCancelText}>취소</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalSubmitBtn, (!reportText.trim() || reporting) && styles.btnDisabled]}
                    onPress={handleReport}
                    disabled={!reportText.trim() || reporting}
                  >
                    {reporting
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.modalSubmitText}>신고하기</Text>}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* 약속 설정 모달 */}
      <Modal visible={meetingModalVisible} transparent animationType="slide" onRequestClose={() => setMeetingModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>약속 설정</Text>
            <Text style={styles.modalSub}>장소, 날짜, 시간을 입력하면 상대팀에게도 공유돼요.</Text>
            <TextInput
              style={styles.meetingInput}
              value={meetingPlace}
              onChangeText={setMeetingPlace}
              placeholder="장소 (예: 충북대 정문 카페)"
              placeholderTextColor="#99a1af"
            />
            <TextInput
              style={styles.meetingInput}
              value={meetingDate}
              onChangeText={setMeetingDate}
              placeholder="날짜 (예: 7월 5일 토요일)"
              placeholderTextColor="#99a1af"
            />
            <TextInput
              style={styles.meetingInput}
              value={meetingTime}
              onChangeText={setMeetingTime}
              placeholder="시간 (예: 오후 6시)"
              placeholderTextColor="#99a1af"
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setMeetingModalVisible(false)}>
                <Text style={styles.modalCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, savingMeeting && styles.btnDisabled]}
                onPress={handleSaveMeeting}
                disabled={savingMeeting}
              >
                {savingMeeting
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.modalSubmitText}>
                      {isMeetingConfirmed ? '수정하기' : '저장 & 확인'}
                    </Text>
                }
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
  reportBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 6 },
  reportBtnText: { fontSize: 12, color: '#6a7282', fontWeight: '600' },
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
    gap: 8, paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6', backgroundColor: '#fafafa',
  },
  meetingCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#eef2ff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
    marginBottom: 4,
  },
  meetingCardText: { fontSize: 13, fontWeight: '600', color: '#3730a3' },
  meetingCardSub: { fontSize: 11, color: '#6366f1', marginTop: 1 },
  statusChips: { flexDirection: 'row', gap: 8 },
  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#f3f4f6', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5,
  },
  statusChipActive: { backgroundColor: '#d1fae5' },
  statusChipText: { fontSize: 12, color: '#6a7282', fontWeight: '500' },
  statusChipTextActive: { color: '#10b981', fontWeight: '700' },
  meetingInput: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: '#0a0a0a',
    marginBottom: 8,
  },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  messageList: { paddingHorizontal: 12, paddingVertical: 12, gap: 6 },
  botMsgContainer: {
    backgroundColor: '#f3f4f6', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10,
    marginVertical: 8, alignSelf: 'center', maxWidth: '85%',
  },
  botMsg: { fontSize: 13, color: '#6a7282', textAlign: 'center', lineHeight: 20 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginVertical: 2 },
  msgRowMe: { justifyContent: 'flex-end' },
  bubbleWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, maxWidth: '75%' },
  bubbleWrapMe: { flexDirection: 'row-reverse' },
  unreadCount: { fontSize: 11, color: '#f59e0b', fontWeight: '700', alignSelf: 'flex-end', marginBottom: 4 },
  msgBubble: {
    borderRadius: 18, borderBottomLeftRadius: 4,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  msgBubbleOwn: {
    backgroundColor: '#fff', borderBottomLeftRadius: 18, borderBottomRightRadius: 4,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  msgBubbleOther: { backgroundColor: '#000', borderBottomLeftRadius: 4 },
  senderName: { fontSize: 11, fontWeight: '600', color: '#6a7282', marginBottom: 3 },
  senderNameOther: { color: 'rgba(255,255,255,0.55)' },
  msgText: { fontSize: 15, lineHeight: 22 },
  msgTextOwn: { color: '#0a0a0a' },
  msgTextOther: { color: '#fff' },
  msgTime: { fontSize: 10, marginTop: 3, textAlign: 'right' },
  msgTimeOwn: { color: '#9ca3af' },
  msgTimeOther: { color: 'rgba(255,255,255,0.4)' },
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
  completedEmoji: { fontSize: 52, textAlign: 'center', marginBottom: 12 },
  completedTitle: { fontSize: 24, fontWeight: '800', color: '#0a0a0a', textAlign: 'center', marginBottom: 8 },
  completedDesc: { fontSize: 14, color: '#6a7282', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  completedConfirmBtn: { backgroundColor: '#000', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  completedConfirmText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  completeInfoBox: {
    backgroundColor: '#f3f4f6', borderRadius: 14, padding: 16,
    alignItems: 'center', marginBottom: 14,
  },
  completeCountText: { fontSize: 22, fontWeight: '800', color: '#0a0a0a', marginBottom: 4 },
  completeInfoText: { fontSize: 13, color: '#6a7282', textAlign: 'center' },
  memberSelectRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  memberSelectAvatar: {
    width: 38, height: 38, backgroundColor: '#000', borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  memberSelectAvatarText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  memberSelectName: { fontSize: 15, fontWeight: '600', color: '#0a0a0a' },
  memberSelectDept: { fontSize: 12, color: '#6a7282', marginTop: 1 },
  emptyMemberBox: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  emptyMemberText: { fontSize: 13, color: '#99a1af' },
  reportHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
});
