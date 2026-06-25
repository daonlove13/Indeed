import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Alert, TextInput, Modal, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { getStudentCardUrl, approveUser, rejectUser } from '../../services/api';

export default function VerifyDetailScreen() {
  const { userId, name, department, cardUrl } = useLocalSearchParams<{
    userId: string; name: string; department: string; cardUrl: string;
  }>();
  const insets = useSafeAreaInsets();
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    if (cardUrl) {
      getStudentCardUrl(cardUrl)
        .then(setSignedUrl)
        .catch(() => setImageLoading(false));
    }
  }, [cardUrl]);

  const handleApprove = () => {
    Alert.alert('승인', `${name}님의 학생증을 승인할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '승인',
        onPress: async () => {
          setSubmitting(true);
          try {
            await approveUser(userId);
            Alert.alert('완료', '승인됐어요.', [{ text: '확인', onPress: () => router.back() }]);
          } catch (e) {
            Alert.alert('오류', String(e));
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setSubmitting(true);
    try {
      await rejectUser(userId, rejectReason.trim());
      setRejectModal(false);
      Alert.alert('완료', '거절됐어요.', [{ text: '확인', onPress: () => router.back() }]);
    } catch (e) {
      Alert.alert('오류', String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { marginTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="chevron-left" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>학생증 심사</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.infoBox}>
          <Text style={styles.infoName}>{name}</Text>
          <Text style={styles.infoDept}>{department}</Text>
        </View>

        <View style={styles.imageWrapper}>
          {imageLoading && <ActivityIndicator size="large" color="#000" style={styles.imageLoader} />}
          {signedUrl ? (
            <Image
              source={{ uri: signedUrl }}
              style={styles.cardImage}
              contentFit="contain"
              onLoadEnd={() => setImageLoading(false)}
              onError={() => setImageLoading(false)}
            />
          ) : !imageLoading ? (
            <View style={styles.noImage}>
              <Feather name="image" size={40} color="#d1d5db" />
              <Text style={styles.noImageText}>이미지를 불러올 수 없어요</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.btnRow}>
          <TouchableOpacity
            style={[styles.rejectBtn, submitting && styles.btnDisabled]}
            onPress={() => setRejectModal(true)}
            disabled={submitting}
          >
            <Text style={styles.rejectText}>거절</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.approveBtn, submitting && styles.btnDisabled]}
            onPress={handleApprove}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.approveText}>승인</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={rejectModal} transparent animationType="slide" onRequestClose={() => setRejectModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>거절 사유</Text>
            <TextInput
              style={styles.modalInput}
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="거절 사유를 입력해주세요 (유저에게 전달돼요)"
              placeholderTextColor="#99a1af"
              multiline
              maxLength={200}
              autoFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setRejectModal(false); setRejectReason(''); }}>
                <Text style={styles.modalCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, (!rejectReason.trim() || submitting) && styles.btnDisabled]}
                onPress={handleReject}
                disabled={!rejectReason.trim() || submitting}
              >
                {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalSubmitText}>거절하기</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    height: 56, paddingHorizontal: 8, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#0a0a0a' },
  scroll: { padding: 20, gap: 20 },
  infoBox: {
    backgroundColor: '#f9fafb', borderRadius: 16, padding: 16, gap: 4,
  },
  infoName: { fontSize: 18, fontWeight: '700', color: '#0a0a0a' },
  infoDept: { fontSize: 14, color: '#6a7282' },
  imageWrapper: {
    width: '100%', minHeight: 300, backgroundColor: '#f3f4f6',
    borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
  },
  imageLoader: { position: 'absolute' },
  cardImage: { width: '100%', height: 400 },
  noImage: { alignItems: 'center', gap: 12, padding: 40 },
  noImageText: { fontSize: 14, color: '#99a1af' },
  btnRow: { flexDirection: 'row', gap: 12 },
  rejectBtn: {
    flex: 1, paddingVertical: 16, borderRadius: 16,
    backgroundColor: '#f3f4f6', alignItems: 'center',
  },
  rejectText: { fontSize: 16, fontWeight: '700', color: '#ef4444' },
  approveBtn: {
    flex: 2, paddingVertical: 16, borderRadius: 16,
    backgroundColor: '#000', alignItems: 'center',
  },
  approveText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  btnDisabled: { opacity: 0.5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0a0a0a', marginBottom: 14 },
  modalInput: {
    backgroundColor: '#f3f4f6', borderRadius: 14, padding: 14,
    fontSize: 14, color: '#0a0a0a', minHeight: 100, textAlignVertical: 'top', marginBottom: 16,
  },
  modalBtns: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#f3f4f6', alignItems: 'center' },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: '#6a7282' },
  modalSubmitBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#ef4444', alignItems: 'center' },
  modalSubmitText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
