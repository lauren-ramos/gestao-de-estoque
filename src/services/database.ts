import { supabase } from './supabase';
import type {
  Insumo,
  Movimentacao,
  OrdemCompra,
  ItemOC,
  ErroOC,
  DashboardStats,
  WeeklyData,
} from '../types';

// ─── Insumos ──────────────────────────────────────────────────────────────────

export async function getInsumos(): Promise<Insumo[]> {
  const { data, error } = await supabase
    .from('insumos')
    .select('*')
    .order('nome');
  if (error) throw error;
  return data ?? [];
}

export async function upsertInsumo(insumo: Partial<Insumo>): Promise<Insumo> {
  const { data, error } = await supabase
    .from('insumos')
    .upsert(insumo)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Movimentações ────────────────────────────────────────────────────────────

export async function getMovimentacoes(limit = 50): Promise<Movimentacao[]> {
  const { data, error } = await supabase
    .from('movimentacoes')
    .select('*')
    .order('data', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function createMovimentacao(
  mov: Omit<Movimentacao, 'id' | 'created_at'>,
): Promise<Movimentacao> {
  const { data, error } = await supabase
    .from('movimentacoes')
    .insert(mov)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Ordens de Compra ─────────────────────────────────────────────────────────

export async function getOCsPendentes(): Promise<OrdemCompra[]> {
  const { data, error } = await supabase
    .from('ordens_compra')
    .select('*')
    .eq('status', 'pendente')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getItensOC(ocId: string): Promise<ItemOC[]> {
  const { data, error } = await supabase
    .from('itens_oc')
    .select('*')
    .eq('oc_id', ocId);
  if (error) throw error;
  return data ?? [];
}

export async function salvarItemOC(item: Partial<ItemOC>): Promise<ItemOC> {
  const { data, error } = await supabase
    .from('itens_oc')
    .upsert(item)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function atualizarStatusOC(
  ocId: string,
  status: OrdemCompra['status'],
): Promise<void> {
  const { error } = await supabase
    .from('ordens_compra')
    .update({ status })
    .eq('id', ocId);
  if (error) throw error;
}

export async function relatarErroOC(erro: Omit<ErroOC, 'id' | 'created_at'>): Promise<ErroOC> {
  const { data, error } = await supabase
    .from('erros_oc')
    .insert(erro)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboardStats(): Promise<DashboardStats> {
  const [insumosRes, movRes] = await Promise.all([
    supabase.from('insumos').select('id, nome, quantidade_atual'),
    supabase
      .from('movimentacoes')
      .select('insumo_nome')
      .order('created_at', { ascending: false }),
  ]);

  const insumos = insumosRes.data ?? [];
  const movs = movRes.data ?? [];

  const totalInsumos = insumos.length;
  const produtosNoEstoque = insumos.filter((i) => i.quantidade_atual > 0).length;

  // most used insumo by movement count
  const freq: Record<string, number> = {};
  for (const m of movs) {
    freq[m.insumo_nome] = (freq[m.insumo_nome] ?? 0) + 1;
  }
  const insumoMaisUtilizado =
    Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

  return { totalInsumos, insumoMaisUtilizado, produtosNoEstoque };
}

export async function getWeeklyData(): Promise<WeeklyData> {
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const now = new Date();
  const labels: string[] = [];
  const entradas: number[] = [];
  const saidas: number[] = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(months[d.getMonth()]);

    const start = d.toISOString().slice(0, 7) + '-01';
    const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const end = nextMonth.toISOString().slice(0, 10);

    const [eRes, sRes] = await Promise.all([
      supabase
        .from('movimentacoes')
        .select('id', { count: 'exact', head: true })
        .eq('tipo', 'entrada')
        .gte('data', start)
        .lt('data', end),
      supabase
        .from('movimentacoes')
        .select('id', { count: 'exact', head: true })
        .eq('tipo', 'saida')
        .gte('data', start)
        .lt('data', end),
    ]);

    entradas.push(eRes.count ?? 0);
    saidas.push(sRes.count ?? 0);
  }

  return { labels, entradas, saidas };
}
