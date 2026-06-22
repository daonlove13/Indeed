import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform, Modal, FlatList,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { createUserProfile } from '../services/api';

const DEPARTMENTS = [
  '간호학과', '건축학과', '경영학과', '경제학과', '관광학과', '교육학과',
  '금융학과', '기계공학과', '독어독문학과', '디자인학과', '마케팅학과',
  '미술학과', '미디어커뮤니케이션학과', '법학과', '생명과학과', '소프트웨어학과',
  '수학과', '스포츠학과', '식품영양학과', '신문방송학과', '심리학과',
  '역사학과', '영어영문학과', '유아교육학과', '음악학과', '의학과',
  '일어일문학과', '재료공학과', '전기공학과', '전자공학과', '정보통신공학과',
  '정치외교학과', '중어중문학과', '철학과', '체육학과', '컴퓨터공학과',
  '토목환경공학과', '특수교육학과', '패션학과', '행정학과', '화학과',
  '화학공학과', '회계학과', '환경학과', '호텔경영학과', '항공서비스학과',
  '한의학과', '치의학과', '약학과', '산업공학과', '국어국문학과', '사회복지학과',
  '사회학과', '무역학과', '연극학과', '영화학과',
].sort();

const formatPhone = (val: string) => {
  const digits = val.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
};

export default function ProfileSetupPage() {
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [studentId, setStudentId] = useState('');
  const [gender, setGender] = useState<'남' | '여' | ''>('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showDeptPicker, setShowDeptPicker] = useState(false);

  const isNameValid = name.trim().length >= 2;
  const isDeptValid = department !== '';
  const isStudentIdValid = studentId.replace(/\D/g, '').length >= 8;
  const isGenderValid = gender !== '';
  const isPhoneValid = phone.replace(/\D/g, '').length === 11;
  const isAllValid = isNameValid && isDeptValid && isStudentIdValid && isGenderValid && isPhoneValid;

  const handleDone = async () => {
    if (!isAllValid) return;
    setLoading(true);
    setErrorMsg('');
    try {
      await createUserProfile({
        name: name.trim(),
        department,
        gender: gender === '남' ? '남성' : '여성',
        studentId,
        phone,
      });
      router.replace('/student-id');
    } catch (e) {
      setErrorMsg(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="chevron-left" size={20} color="#6a7282" />
          <Text style={styles.backText}>뒤로</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>기본 정보를{'\n'}입력해주세요</Text>
        <Text style={styles.subtitle}>매칭과 팀 구성에 사용돼요. 외부에 공개되지 않아요.</Text>

        <Text style={styles.label}>이름</Text>
        <View style={[styles.inputBox, isNameValid && styles.inputBoxActive]}>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="실명을 입력해주세요"
            placeholderTextColor="#99a1af"
          />
        </View>

        <Text style={styles.label}>학과</Text>
        <TouchableOpacity
          style={[styles.inputBox, styles.selectBox, isDeptValid && styles.inputBoxActive]}
          onPress={() => setShowDeptPicker(true)}
        >
          <Text style={[styles.input, !department && { color: '#99a1af' }]}>
            {department || '학과를 선택해주세요'}
          </Text>
          <Feather name="chevron-down" size={16} color="#99a1af" />
        </TouchableOpacity>

        <Text style={styles.label}>학번</Text>
        <View style={[styles.inputBox, isStudentIdValid && styles.inputBoxActive]}>
          <TextInput
            style={styles.input}
            value={studentId}
            onChangeText={v => setStudentId(v.replace(/\D/g, '').slice(0, 10))}
            placeholder="예) 2024123456"
            placeholderTextColor="#99a1af"
            keyboardType="numeric"
          />
        </View>
        {studentId.length > 0 && !isStudentIdValid && (
          <Text style={styles.errorHint}>학번은 8자리 이상 숫자로 입력해주세요</Text>
        )}

        <Text style={styles.label}>성별</Text>
        <View style={styles.genderRow}>
          {(['남', '여'] as const).map(g => (
            <TouchableOpacity
              key={g}
              style={[styles.genderBtn, gender === g && styles.genderBtnActive]}
              onPress={() => setGender(g)}
            >
              <Text style={[styles.genderText, gender === g && styles.genderTextActive]}>
                {g === '남' ? '남성' : '여성'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>전화번호</Text>
        <View style={[styles.inputBox, isPhoneValid && styles.inputBoxActive]}>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={v => setPhone(formatPhone(v))}
            placeholder="010-0000-0000"
            placeholderTextColor="#99a1af"
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            · 입력한 정보는 학생증 인증 확인에 사용돼요.{'\n'}
            · 이름과 성별은 팀 매칭 상대에게만 공개돼요.{'\n'}
            · 전화번호는 고객 지원 목적으로만 사용돼요.
          </Text>
        </View>

        {!!errorMsg && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.cta}>
        <TouchableOpacity
          style={[styles.ctaBtn, (!isAllValid || loading) && styles.ctaBtnDisabled]}
          onPress={handleDone}
          disabled={!isAllValid || loading}
        >
          {loading && <ActivityIndicator size="small" color="#99a1af" />}
          <Text style={[styles.ctaBtnText, (!isAllValid || loading) && styles.ctaBtnTextDisabled]}>
            다음 · 학생증 인증
          </Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showDeptPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>학과 선택</Text>
            <FlatList
              data={DEPARTMENTS}
              keyExtractor={item => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.deptItem}
                  onPress={() => { setDepartment(item); setShowDeptPicker(false); }}
                >
                  <Text style={[styles.deptText, item === department && styles.deptTextActive]}>
                    {item}
                  </Text>
                  {item === department && <Feather name="check" size={16} color="#000" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 44,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backText: {
    fontSize: 13,
    color: '#6a7282',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 30,
    paddingBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0a0a0a',
    lineHeight: 30,
    marginBottom: 6,
    marginTop: 8,
  },
  subtitle: {
    fontSize: 13,
    color: '#6a7282',
    marginBottom: 24,
    lineHeight: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0a0a0a',
    marginBottom: 8,
  },
  inputBox: {
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
  },
  inputBoxActive: {
    borderColor: '#000',
  },
  selectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  input: {
    fontSize: 15,
    color: '#0a0a0a',
    flex: 1,
  },
  errorHint: {
    fontSize: 11,
    color: '#e24b4a',
    marginTop: -10,
    marginBottom: 14,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  genderBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  genderBtnActive: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  genderText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6a7282',
  },
  genderTextActive: {
    color: '#fff',
  },
  infoBox: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 12,
    color: '#6a7282',
    lineHeight: 19,
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 12,
    color: '#dc2626',
    lineHeight: 18,
  },
  cta: {
    paddingHorizontal: 30,
    paddingBottom: 36,
    paddingTop: 8,
    backgroundColor: '#fff',
  },
  ctaBtn: {
    backgroundColor: '#000',
    borderRadius: 14,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaBtnDisabled: {
    backgroundColor: '#e5e7eb',
  },
  ctaBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  ctaBtnTextDisabled: {
    color: '#99a1af',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0a0a0a',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  deptItem: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  deptText: {
    fontSize: 15,
    color: '#0a0a0a',
  },
  deptTextActive: {
    fontWeight: '700',
    color: '#000',
  },
});
