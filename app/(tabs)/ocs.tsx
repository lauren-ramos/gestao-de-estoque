import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../../src/components/AppHeader';
import { Card } from '../../src/components/Card';
import { Colors } from '../../src/constants/colors';
import { getOCsPendentes } from '../../src/services/database';
import type { OrdemCompra } from '../../src/types';

export default function OCsScreen() {
  const router = useRouter();
  const [ocs, setOcs] = useState<OrdemCompra[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getOCsPendentes();
      setOcs(data);
    } catch {
      // empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader />
      <View style={styles.header}>
        <Text style={styles.title}>Entrada de estoque</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <Card style={styles.tableCard} padding={16}>
          <Text style={styles.sectionLabel}>OCs pendentes</Text>
          <FlatList
            data={ocs}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="checkmark-circle-outline" size={40} color={Colors.border} />
                <Text style={styles.emptyText}>Sem OCs pendentes</Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.ocRow}
                onPress={() => router.push({ pathname: '/conferencia/[id]', params: { id: item.id } })}
                activeOpacity={0.7}
              >
                <Text style={styles.ocNum}>#{item.numero}</Text>
                <Text style={styles.ocStatus}>{item.status}</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </Card>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', color: Colors.text },
  tableCard: { marginHorizontal: 16, flex: 1 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  ocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  ocNum: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.primary },
  ocStatus: { fontSize: 12, color: Colors.textSecondary, marginRight: 8 },
  separator: { height: 1, backgroundColor: Colors.border },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyText: { color: Colors.textMuted, fontSize: 14 },
});
