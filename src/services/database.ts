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
import type { SiengeResource, SiengeMovimentacao } from './sienge';

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

export async function getMovimentacoes(limit = 15): Promise<Movimentacao[]> {
  const { data, error } = await supabase
    .from('movimentacoes')
    .select('*')
    .order('data', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

// Busca movimentações do banco por resourceId/detailId do Sienge (após sync)
export async function getMovimentacoesBySiengeResource(
  resourceId: number,
  detailId: number | null,
): Promise<Movimentacao[]> {
  let query = supabase
    .from('movimentacoes')
    .select('*')
    .eq('sienge_resource_id', resourceId)
    .order('data', { ascending: false });
  if (detailId != null) {
    query = query.eq('sienge_detail_id', detailId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getMovimentacoesByInsumoNome(nome: string): Promise<Movimentacao[]> {
  const { data, error } = await supabase
    .from('movimentacoes')
    .select('*')
    .eq('insumo_nome', nome)
    .order('data', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getUltimasMovimentacoes(): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('movimentacoes')
    .select('insumo_nome, data')
    .order('data', { ascending: false });
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const m of data ?? []) {
    if (!map[m.insumo_nome]) map[m.insumo_nome] = m.data;
  }
  return map;
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

// ─── Sync Sienge → Supabase ───────────────────────────────────────────────────

export async function syncSiengeInsumos(resources: SiengeResource[]): Promise<void> {
  if (resources.length === 0) return;
  const rows = resources.map((r) => ({
    nome: r.resourceName,
    detalhe: r.detailDescription ?? undefined,
    quantidade_atual: r.quantity,
    sienge_resource_id: r.resourceId,
    sienge_detail_id: r.detailId,
    sienge_code: r.code,  // "33" ou "33.2" — chave única não-nula
  }));
  const { error } = await supabase
    .from('insumos')
    .upsert(rows, { onConflict: 'sienge_code' });
  if (error) console.warn('[DB] syncSiengeInsumos:', error.message);
}

export async function syncSiengeMovimentos(
  movs: SiengeMovimentacao[],
  insumoNome: string,
  resourceId: number,
  detailId: number | null,
): Promise<void> {
  if (movs.length === 0) return;
  const rows = movs.map((m) => ({
    // insumo_id null para não disparar o trigger de quantidade (Sienge é fonte da verdade)
    insumo_id: null,
    insumo_nome: insumoNome,
    tipo: m.tipo,
    quantidade: m.quantidade,
    data: m.data,
    observacao: [m.documento, m.fornecedor].filter(Boolean).join(' — ') || undefined,
    sienge_movement_id: m.id,
    sienge_resource_id: resourceId,
    sienge_detail_id: detailId,
  }));
  const { error } = await supabase
    .from('movimentacoes')
    .upsert(rows, { onConflict: 'sienge_movement_id', ignoreDuplicates: true });
  if (error) console.warn('[DB] syncSiengeMovimentos:', error.message);
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboardStats(): Promise<DashboardStats> {
  const [insumosRes, movRes] = await Promise.all([
    supabase.from('insumos').select('id, nome, quantidade_atual'),
    supabase
      .from('movimentacoes')
      .select('insumo_nome, tipo')
      .eq('tipo', 'saida'),
  ]);

  const insumos = insumosRes.data ?? [];
  const movs = movRes.data ?? [];

  const totalInsumos = insumos.length;

  // Soma total das quantidades em estoque
  let totalQtd = 0;
  for (let i = 0; i < insumos.length; i++) {
    totalQtd += insumos[i].quantidade_atual || 0;
  }

  // Insumo com mais saídas (por número de movimentações, não por quantidade)
  const freq: Record<string, number> = {};
  for (let i = 0; i < movs.length; i++) {
    const nome = movs[i].insumo_nome;
    freq[nome] = (freq[nome] ?? 0) + 1;
  }
  const insumoMaisUtilizado =
    Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

  return { totalInsumos, insumoMaisUtilizado, produtosNoEstoque: totalQtd };
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
