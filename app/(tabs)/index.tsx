import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppHeader } from '../../src/components/AppHeader';
import { Card } from '../../src/components/Card';
import { Colors } from '../../src/constants/colors';
import { getDashboardStats, getWeeklyData } from '../../src/services/database';
import type { DashboardStats, WeeklyData } from '../../src/types';

export default function DashboardScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [weekly, setWeekly] = useState<WeeklyData | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, w] = await Promise.all([getDashboardStats(), getWeeklyData()]);
      setStats(s);
      setWeekly(w);
    } catch {
      // Supabase not configured yet
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
      <AppHeader userName="" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatCard title="Insumos cadastrados" value={stats?.totalInsumos} />
          <StatCard title="Insumo mais utilizado" value={stats?.insumoMaisUtilizado} small />
        </View>
        <Card style={styles.statsFull}>
          <Text style={styles.statLabel}>Quantidade total em estoque</Text>
          <Text style={styles.statValue}>
            {stats != null
              ? stats.produtosNoEstoque % 1 === 0
                ? stats.produtosNoEstoque
                : stats.produtosNoEstoque.toFixed(2)
              : '—'}
          </Text>
        </Card>

        {/* Stacked bar chart: entradas vs saídas por mês */}
        <Card style={styles.chartCard} padding={16}>
          <Text style={styles.sectionTitle}>Estatística mensal do estoque</Text>
          {weekly ? (
            <StackedBarChart data={weekly} />
          ) : (
            <View style={styles.chartPlaceholder} />
          )}
        </Card>

        {/* Quick access */}
        <Text style={styles.sectionTitle}>Acesso Rápido</Text>
        <QuickCard
          title="Insumos"
          icon="archive-outline"
          onPress={() => router.push('/(tabs)/insumos')}
          variant="light"
        />
        <QuickCard
          title="Movimentações"
          icon="truck-delivery-outline"
          onPress={() => router.push('/(tabs)/movimentacao')}
          variant="light"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Gráfico de barras empilhadas ─────────────────────────────────────────────

function StackedBarChart({ data }: { data: WeeklyData }) {
  const BAR_MAX_H = 120;
  let maxVal = 1;
  for (let i = 0; i < data.labels.length; i++) {
    const total = (data.entradas[i] ?? 0) + (data.saidas[i] ?? 0);
    if (total > maxVal) maxVal = total;
  }

  return (
    <View>
      {/* Legenda */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#22c55e' }]} />
          <Text style={styles.legendText}>Entradas</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
          <Text style={styles.legendText}>Saídas</Text>
        </View>
      </View>

      {/* Barras */}
      <View style={[styles.barsRow, { height: BAR_MAX_H + 24 }]}>
        {data.labels.map((label, i) => {
          const e = data.entradas[i] ?? 0;
          const s = data.saidas[i] ?? 0;
          const total = e + s;
          const totalH = maxVal > 0 ? (total / maxVal) * BAR_MAX_H : 0;
          const entradaH = total > 0 ? (e / total) * totalH : 0;
          const saidaH = totalH - entradaH;

          return (
            <View key={label} style={styles.barWrap}>
              <View style={[styles.barInner, { height: BAR_MAX_H }]}>
                <View style={{ justifyContent: 'flex-end', flex: 1 }}>
                  {totalH > 0 && (
                    <View style={styles.barStack}>
                      {saidaH > 0 && (
                        <View style={{ height: saidaH, backgroundColor: '#ef4444' }} />
                      )}
                      {entradaH > 0 && (
                        <View style={{ height: entradaH, backgroundColor: '#22c55e' }} />
                      )}
                    </View>
                  )}
                </View>
              </View>
              <Text style={styles.barLabel}>{label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Componentes auxiliares ────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  small,
}: {
  title: string;
  value?: string | number;
  small?: boolean;
}) {
  return (
    <Card style={styles.statCard}>
      <Text style={styles.statLabel}>{title}</Text>
      {value !== undefined && (
        <Text style={[styles.statValue, small && styles.statValueSm]}>{value}</Text>
      )}
    </Card>
  );
}

function QuickCard({
  title,
  icon,
  onPress,
  variant,
}: {
  title: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress: () => void;
  variant: 'light' | 'purple';
}) {
  const isPurple = variant === 'purple';
  return (
    <TouchableOpacity
      style={[styles.quickCard, isPurple && styles.quickCardPurple]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={[styles.quickIcon, isPurple && styles.quickIconPurple]}>
        <MaterialCommunityIcons name={icon} size={26} color={isPurple ? Colors.white : Colors.text} />
      </View>
      <Text style={[styles.quickTitle, isPurple && styles.quickTitleLight]}>{title}</Text>
      <MaterialCommunityIcons
        name="chevron-right"
        size={18}
        color={isPurple ? Colors.white : Colors.textSecondary}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.white },
  scroll: { padding: 16, paddingBottom: 32 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statCard: { flex: 1 },
  statsFull: { marginBottom: 16 },
  statLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500', marginBottom: 4 },
  statValue: { fontSize: 22, fontWeight: '700', color: Colors.text },
  statValueSm: { fontSize: 14, fontWeight: '600' },

  chartCard: { marginBottom: 20 },
  chartPlaceholder: { height: 150, backgroundColor: Colors.background, borderRadius: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 12 },

  // Chart
  legendRow: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 2 },
  legendText: { fontSize: 11, color: Colors.textSecondary },
  barsRow: { flexDirection: 'row', alignItems: 'flex-end' },
  barWrap: { flex: 1, alignItems: 'center' },
  barInner: { width: '55%', justifyContent: 'flex-end' },
  barStack: { borderRadius: 4, overflow: 'hidden' },
  barLabel: { fontSize: 10, color: Colors.textMuted, marginTop: 4 },

  // Quick cards
  quickCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  quickCardPurple: { backgroundColor: Colors.primary },
  quickIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  quickIconPurple: { backgroundColor: 'rgba(255,255,255,0.2)' },
  quickTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.text },
  quickTitleLight: { color: Colors.white },
});
