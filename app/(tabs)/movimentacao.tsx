import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../../src/components/AppHeader';
import { Card } from '../../src/components/Card';
import { Colors } from '../../src/constants/colors';
import { getMovimentacoes } from '../../src/services/database';
import type { Movimentacao } from '../../src/types';

export default function MovimentacaoScreen() {
  const router = useRouter();
  const [movs, setMovs] = useState<Movimentacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await getMovimentacoes(500);
      setMovs(data);
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

  const filtered = useMemo(() => {
    if (!search.trim()) return movs;
    const q = search.toLowerCase().trim();
    return movs.filter((m) => m.insumo_nome?.toLowerCase().includes(q));
  }, [movs, search]);

  const renderItem = useCallback(
    ({ item }: { item: Movimentacao }) => <MovRow item={item} />,
    [],
  );

  const renderSeparator = useCallback(
    () => <View style={styles.separator} />,
    [],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader />

      <View style={styles.header}>
        <Text style={styles.title}>Movimentação de estoque</Text>
      </View>

      {/* Ações rápidas */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnIn]}
          onPress={() => router.push('/entrada')}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="package-variant-closed-plus" size={22} color={Colors.white} />
          <Text style={styles.actionLabelLight}>Entrada de estoque</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnOut]}
          onPress={() => router.push('/saida')}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="package-variant-closed-remove" size={22} color={Colors.text} />
          <Text style={styles.actionLabel}>Saída de estoque</Text>
        </TouchableOpacity>
      </View>

      {/* Pesquisa */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Pesquisar por insumo..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.sectionTitle}>
        {search.trim()
          ? `Resultados para "${search.trim()}" (${filtered.length})`
          : 'Últimas Movimentações'}
      </Text>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 32 }} />
      ) : (
        <Card style={styles.tableCard} padding={0}>
          <View style={styles.tableHeader}>
            <Text style={[styles.col, styles.colWide]}>Insumo</Text>
            <Text style={styles.col}>Data</Text>
            <Text style={styles.col}>Movimentação</Text>
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={Colors.primary}
              />
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="swap-vertical-outline" size={36} color={Colors.border} />
                <Text style={styles.emptyText}>
                  {search ? 'Nenhuma movimentação encontrada' : 'Nenhuma movimentação registrada'}
                </Text>
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

function MovRow({ item }: { item: Movimentacao }) {
  const isEntrada = item.tipo === 'entrada';
  const dateStr = new Date(item.data).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });

  return (
    <View style={styles.row}>
      <Text style={[styles.col, styles.colWide, styles.cellText]} numberOfLines={1}>
        {item.insumo_nome}
      </Text>
      <Text style={[styles.col, styles.cellText]}>{dateStr}</Text>
      <View style={[styles.col, styles.badge, isEntrada ? styles.badgeIn : styles.badgeOut]}>
        <Text style={[styles.badgeText, isEntrada ? styles.badgeTextIn : styles.badgeTextOut]}>
          {isEntrada ? `+${item.quantidade}` : `-${item.quantidade}`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 20, fontWeight: '700', color: Colors.text },

  actions: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 14,
  },
  actionBtnIn: { backgroundColor: Colors.primary },
  actionBtnOut: {
    backgroundColor: Colors.white,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  actionLabel: { fontSize: 15, fontWeight: '700', color: Colors.text },
  actionLabelLight: { fontSize: 15, fontWeight: '700', color: Colors.white },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text, paddingVertical: 0 },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    paddingHorizontal: 20,
    marginBottom: 8,
  },

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
  col: { flex: 1, fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  colWide: { flex: 2 },
  cellText: { color: Colors.text, fontWeight: '400', fontSize: 13 },
  separator: { height: 1, backgroundColor: Colors.border, marginHorizontal: 16 },
  badge: {
    flex: 1,
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
    alignSelf: 'center',
    alignItems: 'center',
    maxWidth: 64,
  },
  badgeIn: { backgroundColor: '#E8F5E9' },
  badgeOut: { backgroundColor: '#FFEBEE' },
  badgeText: { fontSize: 12, fontWeight: '700' },
  badgeTextIn: { color: Colors.success },
  badgeTextOut: { color: Colors.error },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyText: { color: Colors.textMuted, fontSize: 14 },
});
