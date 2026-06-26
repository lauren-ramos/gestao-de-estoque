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
import { getInsumos } from '../../src/services/database';
import type { Insumo } from '../../src/types';

export default function InsumosScreen() {
  const router = useRouter();
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getInsumos();
      setInsumos(data);
    } catch {
      // empty state when not connected
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

  const goToRegistro = useCallback((insumoId: string, insumoNome: string) => {
    router.push({ pathname: '/novo-registro', params: { insumoId, insumoNome } });
  }, [router]);

  const goToMovimentacao = useCallback(() => {
    router.push('/(tabs)/movimentacao');
  }, [router]);

  const renderItem = useCallback(
    ({ item }: { item: Insumo }) => (
      <InsumoRow
        item={item}
        onPress={() => goToRegistro(item.id, item.nome)}
        onMovPress={goToMovimentacao}
      />
    ),
    [goToRegistro, goToMovimentacao],
  );

  const renderSeparator = useCallback(
    () => <View style={styles.separator} />,
    [],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader />
      <View style={styles.header}>
        <Text style={styles.title}>Insumos</Text>
      </View>

      <TouchableOpacity
        style={styles.newBtn}
        onPress={() => router.push('/novo-registro')}
        activeOpacity={0.85}
      >
        <Ionicons name="cube-outline" size={20} color={Colors.white} />
        <Text style={styles.newBtnText}>Novo Registro</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <Card style={styles.tableCard} padding={0}>
          <View style={styles.tableHeader}>
            <Text style={[styles.col, styles.colWide]}>Insumo</Text>
            <Text style={styles.col}>Qtd</Text>
            <Text style={styles.col}>Movimentação</Text>
          </View>
          <FlatList
            data={insumos}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="cube-outline" size={40} color={Colors.border} />
                <Text style={styles.emptyText}>Nenhum insumo cadastrado</Text>
              </View>
            }
            renderItem={renderItem}
            ItemSeparatorComponent={renderSeparator}
          />
        </Card>
      )}
    </SafeAreaView>
  );
}

interface InsumoRowProps {
  item: Insumo;
  onPress: () => void;
  onMovPress: () => void;
}

function InsumoRow({ item, onPress, onMovPress }: InsumoRowProps) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.col, styles.colWide, styles.cellText]} numberOfLines={1}>
        {item.nome}
      </Text>
      <Text style={[styles.col, styles.cellText]}>{item.quantidade_atual}</Text>
      <TouchableOpacity style={styles.movBtn} onPress={onMovPress}>
        <Ionicons name="swap-vertical-outline" size={16} color={Colors.primary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 20, fontWeight: '700', color: Colors.text },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  newBtnText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
  tableCard: {
    marginHorizontal: 16,
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  col: {
    flex: 1,
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  colWide: { flex: 2 },
  cellText: { color: Colors.text, fontWeight: '400', fontSize: 13 },
  separator: { height: 1, backgroundColor: Colors.border, marginHorizontal: 16 },
  movBtn: { flex: 1, alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyText: { color: Colors.textMuted, fontSize: 14 },
});
