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
  Modal,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../../src/components/AppHeader';
import { Card } from '../../src/components/Card';
import { Colors } from '../../src/constants/colors';
import { syncSiengeInsumos } from '../../src/services/database';
import { getInsumosFromSienge, clearInsumosCache, type SiengeResource } from '../../src/services/sienge';
import { syncAllFromSienge } from '../../src/services/sync';

interface GroupedResource {
  resourceId: number;
  name: string;
  totalQty: number;
  unit: string;
  detailCount: number;
}

export default function InsumosScreen() {
  const router = useRouter();
  const [groups, setGroups] = useState<GroupedResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  // Sync modal
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [syncPct, setSyncPct] = useState(0);

  const load = useCallback(async (refresh = false) => {
    try {
      const data = await getInsumosFromSienge(refresh);
      setGroups(groupByResource(data));
      syncSiengeInsumos(data).catch(() => {});
    } catch (err) {
      console.warn('[Insumos]', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    clearInsumosCache();
    await load(true);
    setRefreshing(false);
  }, [load]);

  const startFullSync = useCallback(async () => {
    Alert.alert(
      'Importar histórico do Sienge',
      'Isso vai buscar todos os insumos e movimentações do Sienge e salvar no banco de dados. Pode demorar alguns minutos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Iniciar',
          onPress: async () => {
            setSyncing(true);
            setSyncPct(0);
            setSyncMsg('Iniciando...');
            try {
              const result = await syncAllFromSienge((msg, current, total) => {
                setSyncMsg(msg);
                setSyncPct(Math.round((current / total) * 100));
              });
              setSyncing(false);
              // Recarrega a lista
              clearInsumosCache();
              await load(true);
              Alert.alert(
                'Concluído!',
                `${result.insumos} insumos e ${result.movimentos} movimentações salvos.${result.erros.length > 0 ? `\n\nErros: ${result.erros.join(', ')}` : ''}`,
              );
            } catch (err) {
              setSyncing(false);
              Alert.alert('Erro na sincronização', String(err));
            }
          },
        },
      ],
    );
  }, [load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.toLowerCase().trim();
    return groups.filter(
      (g) => g.name.toLowerCase().includes(q) || String(g.resourceId).includes(q),
    );
  }, [groups, search]);

  const renderItem = useCallback(
    ({ item }: { item: GroupedResource }) => (
      <ResourceRow
        item={item}
        onPress={() =>
          router.push({
            pathname: '/insumo/[id]',
            params: { id: String(item.resourceId), nome: item.name },
          })
        }
      />
    ),
    [router],
  );

  const renderSeparator = useCallback(() => <View style={styles.separator} />, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader />

      <View style={styles.topRow}>
        <Text style={styles.title}>Insumos</Text>
        <TouchableOpacity style={styles.syncBtn} onPress={startFullSync} activeOpacity={0.8}>
          <Ionicons name="cloud-download-outline" size={16} color={Colors.primary} />
          <Text style={styles.syncBtnText}>Importar Sienge</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Pesquisar por nome ou código..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <Card style={styles.tableCard} padding={0}>
          <View style={styles.tableHeader}>
            <Text style={[styles.col, styles.colCode]}>Cód.</Text>
            <Text style={[styles.col, styles.colWide]}>Insumo</Text>
            <Text style={styles.col}>Qtd Total</Text>
            <Text style={styles.colArrow} />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.resourceId)}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
            }
            renderItem={renderItem}
            ItemSeparatorComponent={renderSeparator}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="cube-outline" size={40} color={Colors.border} />
                <Text style={styles.emptyText}>
                  {search ? 'Nenhum resultado' : 'Nenhum insumo encontrado no Sienge'}
                </Text>
              </View>
            }
          />
        </Card>
      )}

      {/* Modal de progresso da sincronização */}
      <Modal visible={syncing} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <ActivityIndicator color={Colors.primary} size="large" />
            <Text style={styles.modalTitle}>Importando do Sienge...</Text>
            <Text style={styles.modalMsg} numberOfLines={3}>{syncMsg}</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${syncPct}%` }]} />
            </View>
            <Text style={styles.progressPct}>{syncPct}%</Text>
          </View>
        </View>
      </Modal>
      {/* FAB Novo Registro */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/novo-registro')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={24} color={Colors.white} />
        <Text style={styles.fabText}>Novo Registro</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function groupByResource(data: SiengeResource[]): GroupedResource[] {
  const map = new Map<number, GroupedResource>();
  for (let i = 0; i < data.length; i++) {
    const r = data[i];
    const existing = map.get(r.resourceId);
    if (existing) {
      existing.totalQty += r.quantity;
      existing.detailCount += 1;
    } else {
      map.set(r.resourceId, {
        resourceId: r.resourceId,
        name: r.resourceName,
        totalQty: r.quantity,
        unit: r.unit,
        detailCount: 1,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

function ResourceRow({ item, onPress }: { item: GroupedResource; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.col, styles.colCode, styles.codeText]}>{item.resourceId}</Text>
      <View style={[styles.col, styles.colWide]}>
        <Text style={styles.cellText} numberOfLines={1}>{item.name}</Text>
        {item.detailCount > 1 && (
          <Text style={styles.detailHint}>{item.detailCount} detalhes</Text>
        )}
      </View>
      <Text style={[styles.col, styles.cellText]}>
        {item.totalQty % 1 === 0 ? item.totalQty : item.totalQty.toFixed(2)}{' '}
        <Text style={styles.unit}>{item.unit}</Text>
      </Text>
      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} style={styles.colArrow} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  title: { fontSize: 20, fontWeight: '700', color: Colors.text },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  syncBtnText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text, paddingVertical: 0 },
  tableCard: { marginHorizontal: 16, flex: 1, borderRadius: 16, overflow: 'hidden' },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16 },
  col: { flex: 1, fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  colCode: { flex: 0.7 },
  colWide: { flex: 2.5 },
  colArrow: { width: 20 },
  cellText: { color: Colors.text, fontWeight: '400', fontSize: 13 },
  codeText: { color: Colors.primary, fontWeight: '700', fontSize: 13 },
  detailHint: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  unit: { fontSize: 10, color: Colors.textMuted },
  separator: { height: 1, backgroundColor: Colors.border, marginHorizontal: 16 },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyText: { color: Colors.textMuted, fontSize: 14, textAlign: 'center' },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { color: Colors.white, fontSize: 14, fontWeight: '700' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modalBox: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 28,
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  modalMsg: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', minHeight: 40 },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  progressPct: { fontSize: 13, fontWeight: '700', color: Colors.primary },
});
