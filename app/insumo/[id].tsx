import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../../src/components/AppHeader';
import { Card } from '../../src/components/Card';
import { Colors } from '../../src/constants/colors';
import {
  getMovimentacoesBySiengeResource,
  getInsumosByResourceId,
  syncSiengeMovimentos,
} from '../../src/services/database';
import {
  getSiengeMovimentos,
} from '../../src/services/sienge';
import type { Insumo, Movimentacao } from '../../src/types';

const PAGE_SIZE = 15;

export default function InsumoDetalheScreen() {
  const router = useRouter();
  const { id, nome } = useLocalSearchParams<{ id: string; nome: string; fromDb?: string }>();
  const resourceId = Number(id);

  const [details, setDetails] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // Busca detalhes do banco de dados
      const data = await getInsumosByResourceId(resourceId);
      setDetails(data);
      setLoading(false);
    }
    load();
  }, [resourceId]);

  const renderItem = useCallback(
    ({ item }: { item: Insumo }) => (
      <DetailRow
        detail={item}
        onRegister={() =>
          router.push({ pathname: '/novo-registro', params: { insumoNome: item.nome } })
        }
      />
    ),
    [router],
  );

  const renderSeparator = useCallback(() => <View style={styles.separator} />, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.topBarText}>
          <Text style={styles.resourceId}>Cód. {resourceId}</Text>
          <Text style={styles.title} numberOfLines={2}>{nome ?? id}</Text>
        </View>
        <TouchableOpacity
          style={styles.regBtn}
          onPress={() =>
            router.push({ pathname: '/novo-registro', params: { insumoNome: nome ?? '' } })
          }
        >
          <Ionicons name="add" size={20} color={Colors.white} />
          <Text style={styles.regBtnText}>Registro</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 32 }} />
      ) : (
        <Card style={styles.card} padding={0}>
          <FlatList
            data={details}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            ItemSeparatorComponent={renderSeparator}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="cube-outline" size={36} color={Colors.border} />
                <Text style={styles.emptyText}>Nenhum detalhe encontrado</Text>
              </View>
            }
          />
        </Card>
      )}
    </SafeAreaView>
  );
}

// ─── Linha de detalhe com movimentações paginadas ────────────────────────────

function DetailRow({
  detail,
  onRegister,
}: {
  detail: Insumo;
  onRegister: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [movs, setMovs] = useState<Movimentacao[]>([]);
  const [page, setPage] = useState(1);
  const [loadingMovs, setLoadingMovs] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const visibleMovs = movs.slice(0, page * PAGE_SIZE);
  const hasMore = visibleMovs.length < movs.length;

  const resourceId = detail.sienge_resource_id ?? 0;
  const detailId = detail.sienge_detail_id ?? null;

  const loadFromDB = useCallback(async () => {
    const dbData = await getMovimentacoesBySiengeResource(
      resourceId,
      detailId,
    );
    return dbData;
  }, [resourceId, detailId]);

  const refreshFromSienge = useCallback(async () => {
    if (!resourceId) return;
    setRefreshing(true);
    try {
      const fresh = await getSiengeMovimentos(resourceId, detailId);
      await syncSiengeMovimentos(fresh, detail.nome, resourceId, detailId);
      const updated = await getMovimentacoesBySiengeResource(resourceId, detailId);
      setMovs(updated);
      setPage(1);
    } catch (err) {
      console.warn('[DetalheRow] refresh Sienge:', err);
    } finally {
      setRefreshing(false);
    }
  }, [resourceId, detailId, detail.nome]);

  const toggleExpand = useCallback(async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && movs.length === 0) {
      setLoadingMovs(true);
      try {
        const dbData = await loadFromDB();
        setMovs(dbData);
        setPage(1);
        setLoadingMovs(false);

        // Se banco vazio e tem ID Sienge, busca do Sienge
        if (dbData.length === 0 && resourceId) {
          setRefreshing(true);
          const fresh = await getSiengeMovimentos(resourceId, detailId);
          await syncSiengeMovimentos(fresh, detail.nome, resourceId, detailId);
          const saved = await getMovimentacoesBySiengeResource(resourceId, detailId);
          setMovs(saved);
          setPage(1);
          setRefreshing(false);
        }
      } catch (err) {
        console.warn('[DetalheRow] erro movimentações:', err);
        setLoadingMovs(false);
        setRefreshing(false);
      }
    }
  }, [expanded, movs.length, resourceId, detailId, detail.nome, loadFromDB]);

  const displayCode = detailId != null
    ? `${resourceId}.${detailId}`
    : resourceId
    ? String(resourceId)
    : detail.sienge_code ?? '—';

  return (
    <View>
      {/* Cabeçalho do detalhe */}
      <TouchableOpacity style={styles.detailHeader} onPress={toggleExpand} activeOpacity={0.7}>
        <View style={styles.detailLeft}>
          <Text style={styles.detailCode}>{displayCode}</Text>
          <Text style={styles.detailDesc} numberOfLines={1}>
            {detail.detalhe ?? detail.nome}
          </Text>
        </View>
        <Text style={styles.detailQty}>
          {(detail.quantidade_atual ?? 0) % 1 === 0
            ? detail.quantidade_atual ?? 0
            : (detail.quantidade_atual ?? 0).toFixed(2)}
        </Text>
        <TouchableOpacity
          onPress={onRegister}
          style={styles.addBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
        </TouchableOpacity>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={Colors.textMuted}
        />
      </TouchableOpacity>

      {/* Movimentações */}
      {expanded && (
        <View style={styles.movsContainer}>
          {loadingMovs ? (
            <View style={styles.movsLoading}>
              <ActivityIndicator color={Colors.primary} size="small" />
              <Text style={styles.loadingText}>Carregando...</Text>
            </View>
          ) : movs.length === 0 ? (
            <View style={styles.emptyMovs}>
              <Text style={styles.noMovs}>Nenhuma movimentação no banco.</Text>
              <TouchableOpacity style={styles.syncBtn} onPress={refreshFromSienge}>
                <Ionicons name="cloud-download-outline" size={14} color={Colors.primary} />
                <Text style={styles.syncBtnText}>Buscar do Sienge</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Header da tabela */}
              <View style={styles.movsHeader}>
                <Text style={[styles.movCol, styles.movColDate]}>Data</Text>
                <Text style={styles.movCol}>Tipo</Text>
                <Text style={styles.movCol}>Qtd</Text>
                <Text style={[styles.movCol, styles.movColObs]}>Observação</Text>
              </View>

              {visibleMovs.map((m) => (
                <MovRow key={m.id} mov={m} />
              ))}

              {/* Carregar mais */}
              {hasMore && (
                <TouchableOpacity
                  style={styles.loadMoreBtn}
                  onPress={() => setPage((p) => p + 1)}
                >
                  <Ionicons name="chevron-down" size={14} color={Colors.primary} />
                  <Text style={styles.loadMoreText}>
                    Ver mais {Math.min(PAGE_SIZE, movs.length - visibleMovs.length)}{' '}
                    ({movs.length - visibleMovs.length} restantes)
                  </Text>
                </TouchableOpacity>
              )}

              {/* Footer com total e botão de refresh */}
              <View style={styles.movsFooter}>
                <Text style={styles.movsTotal}>
                  {visibleMovs.length} de {movs.length} movimentações
                </Text>
                <TouchableOpacity
                  style={styles.refreshBtn}
                  onPress={refreshFromSienge}
                  disabled={refreshing}
                >
                  {refreshing ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <>
                      <Ionicons name="refresh-outline" size={13} color={Colors.primary} />
                      <Text style={styles.refreshText}>Atualizar do Sienge</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}

function MovRow({ mov }: { mov: Movimentacao }) {
  const isEntrada = mov.tipo === 'entrada';
  const dateStr = new Date(mov.data).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });

  return (
    <View style={styles.movRow}>
      <Text style={[styles.movCol, styles.movColDate, styles.movCellText]}>{dateStr}</Text>
      <View style={styles.movCol}>
        <View style={[styles.badge, isEntrada ? styles.badgeIn : styles.badgeOut]}>
          <Text style={[styles.badgeText, isEntrada ? styles.badgeInText : styles.badgeOutText]}>
            {isEntrada ? 'E' : 'S'}
          </Text>
        </View>
      </View>
      <Text style={[styles.movCol, styles.movCellText]}>{mov.quantidade}</Text>
      <Text style={[styles.movCol, styles.movColObs, styles.movSubText]} numberOfLines={2}>
        {mov.observacao ?? '—'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 10,
  },
  backBtn: { padding: 4, marginTop: 4 },
  topBarText: { flex: 1 },
  resourceId: { fontSize: 11, fontWeight: '700', color: Colors.primary, marginBottom: 2 },
  title: { fontSize: 16, fontWeight: '700', color: Colors.text },
  regBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 4,
    marginTop: 2,
  },
  regBtnText: { color: Colors.white, fontSize: 12, fontWeight: '700' },
  card: { marginHorizontal: 16, flex: 1, borderRadius: 16, overflow: 'hidden' },
  separator: { height: 1, backgroundColor: Colors.border },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { color: Colors.textMuted, fontSize: 14 },

  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
  },
  detailLeft: { flex: 1 },
  detailCode: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  detailDesc: { fontSize: 13, color: Colors.text, marginTop: 1 },
  detailQty: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    minWidth: 60,
    textAlign: 'right',
  },
  detailUnit: { fontSize: 10, fontWeight: '400', color: Colors.textMuted },
  addBtn: { paddingHorizontal: 4 },

  movsContainer: {
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  movsLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  loadingText: { fontSize: 12, color: Colors.textMuted },
  emptyMovs: { alignItems: 'center', paddingVertical: 16, gap: 10 },
  noMovs: { fontSize: 13, color: Colors.textMuted },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  syncBtnText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },

  movsHeader: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: '#f1f5f9',
  },
  movRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  movCol: { flex: 1, fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },
  movColDate: { flex: 1.1 },
  movColObs: { flex: 2.2 },
  movCellText: { color: Colors.text, fontWeight: '400', fontSize: 12 },
  movSubText: { color: Colors.textSecondary, fontSize: 11, fontWeight: '400' },

  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    gap: 5,
    backgroundColor: '#eff6ff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  loadMoreText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },

  movsFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  movsTotal: { fontSize: 11, color: Colors.textMuted },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  refreshText: { fontSize: 11, color: Colors.primary, fontWeight: '600' },

  badge: { paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4, alignSelf: 'flex-start' },
  badgeIn: { backgroundColor: '#dcfce7' },
  badgeOut: { backgroundColor: '#fee2e2' },
  badgeText: { fontSize: 10, fontWeight: '700' },
  badgeInText: { color: '#16a34a' },
  badgeOutText: { color: '#dc2626' },
});
