import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';

export default function RejectedScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Feather name="x" size={40} color="#fff" />
        </View>
        <Text style={styles.title}>인증이 반려됐어요</Text>
        <Text style={styles.desc}>
          학생증 사진을 다시 확인해주세요.{'\n'}
          이름, 학번, 학교명이 모두 보여야 해요.
        </Text>
      </View>
      <View style={styles.cta}>
        <TouchableOpacity style={styles.btn} onPress={() => router.replace('/student-id')}>
          <Text style={styles.btnText}>다시 제출하기</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e24b4a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: { fontSize: 24, fontWeight: '700', color: '#0a0a0a', marginBottom: 12, textAlign: 'center' },
  desc: { fontSize: 14, color: '#6a7282', textAlign: 'center', lineHeight: 22 },
  cta: { paddingHorizontal: 30, paddingBottom: 48 },
  btn: {
    backgroundColor: '#000',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  btnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
