import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useHistory } from '../hooks/useData';

export default function HistoryPage() {
  const { history, loading } = useHistory();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <View style={[styles.header, { marginTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="chevron-left" size={20} color="#6a7282" />
          <Text style={styles.backText}>뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>과팅 내역</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000" />
        </View>
      ) : history.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>📋</Text>
          <Text style={styles.emptyTitle}>아직 과팅 내역이 없어요</Text>
          <Text style={styles.emptyDesc}>첫 번째 과팅을 시작해보세요!</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.historyItem}>
              <View style={styles.historyIcon}>
                <Feather name="heart" size={20} color="#fff" />
              </View>
              <View style={styles.historyInfo}>
                <Text style={styles.historyName}>{item.name}</Text>
                <Text style={styles.historyMeta}>{item.date} · {item.place}</Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 60 },
  backText: { fontSize: 13, color: '#6a7282' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#0a0a0a' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#0a0a0a', marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: '#6a7282', textAlign: 'center' },
  list: { padding: 16 },
  historyItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  historyIcon: {
    width: 44, height: 44, backgroundColor: '#000', borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  historyInfo: { flex: 1 },
  historyName: { fontSize: 15, fontWeight: '600', color: '#0a0a0a' },
  historyMeta: { fontSize: 13, color: '#6a7282', marginTop: 2 },
});
