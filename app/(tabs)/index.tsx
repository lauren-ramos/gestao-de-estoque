import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart } from 'react-native-chart-kit';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppHeader } from '../../src/components/AppHeader';
import { Card } from '../../src/components/Card';
import { Colors } from '../../src/constants/colors';
import { getDashboardStats, getWeeklyData } from '../../src/services/database';
import type { DashboardStats, WeeklyData } from '../../src/types';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 64;

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
      // Supabase not configured yet — show empty state
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const chartData = weekly
    ? {
        labels: weekly.labels,
        datasets: [
          {
            data: weekly.entradas.map((v, i) => v + (weekly.saidas[i] ?? 0)),
            colors: weekly.entradas.map((_, i) =>
              () => i === weekly.entradas.length - 1 ? Colors.primary : Colors.primaryLight,
            ),
          },
        ],
      }
    : { labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'], datasets: [{ data: [0, 0, 0, 0, 0, 0] }] };

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
          <StatCard title="Insumos Cadastrados" value={stats?.totalInsumos} />
          <StatCard title="Insumo mais utilizado" value={stats?.insumoMaisUtilizado} small />
        </View>
        <Card style={styles.statsFull}>
          <Text style={styles.statLabel}>Produtos no estoque</Text>
          <Text style={styles.statValue}>{stats?.produtosNoEstoque ?? '—'}</Text>
        </Card>

        {/* Weekly chart */}
        <Card style={styles.chartCard} padding={16}>
          <Text style={styles.sectionTitle}>Estatística semanal do estoque</Text>
          <BarChart
            data={chartData}
            width={CHART_WIDTH}
            height={200}
            yAxisLabel=""
            yAxisSuffix=""
            chartConfig={{
              backgroundGradientFrom: Colors.white,
              backgroundGradientTo: Colors.white,
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(139, 108, 246, ${opacity})`,
              labelColor: () => Colors.textMuted,
              barPercentage: 0.5,
            }}
            style={{ borderRadius: 8, marginTop: 8 }}
            showBarTops={false}
            fromZero
            withCustomBarColorFromData
            flatColor
          />
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
          title="Movimentação de estoque"
          icon="truck-delivery-outline"
          onPress={() => router.push('/(tabs)/movimentacao')}
          variant="purple"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

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
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginBottom: 4,
  },
  statValue: { fontSize: 22, fontWeight: '700', color: Colors.text },
  statValueSm: { fontSize: 14, fontWeight: '600' },
  chartCard: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
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
  quickTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  quickTitleLight: { color: Colors.white },
});
