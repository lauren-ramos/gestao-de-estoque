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
  // PAGE=50 fica abaixo de qualquer limite do servidor (Supabase max-rows padrão = 1000).
  // Paramos quando o servidor retornar menos de PAGE rows (última página).
  const PAGE = 50;
  const all: Insumo[] = [];
  let from = 0;

  for (let guard = 0; guard < 1000; guard++) {
    const { data, error } = await supabase
      .from('insumos')
      .select('*')
      .order('sienge_code', { ascending: true, nullsFirst: false })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (let i = 0; i < data.length; i++) all.push(data[i]);
    if (data.length < PAGE) break; // última página
    from += PAGE;
  }

  return all;
}

export async function getInsumosByResourceId(resourceId: number): Promise<Insumo[]> {
  const { data, error } = await supabase
    .from('insumos')
    .select('*')
    .eq('sienge_resource_id', resourceId)
    .order('sienge_detail_id', { ascending: true, nullsFirst: true });
  if (error) throw error;
  return data ?? [];
}

export async function searchInsumos(query: string): Promise<Insumo[]> {
  const PAGE = 50;
  const all: Insumo[] = [];
  const filter = `nome.ilike.%${query}%,sienge_code.ilike.%${query}%,detalhe.ilike.%${query}%`;
  let from = 0;

  for (let guard = 0; guard < 1000; guard++) {
    const { data, error } = await supabase
      .from('insumos')
      .select('*')
      .or(filter)
      .order('sienge_code', { ascending: true, nullsFirst: false })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (let i = 0; i < data.length; i++) all.push(data[i]);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  return all;
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

export async function getMovimentacoes(limit = 5000): Promise<Movimentacao[]> {
  const PAGE = 50;
  const all: Movimentacao[] = [];
  let from = 0;

  for (let guard = 0; guard < 200; guard++) {
    const { data, error } = await supabase
      .from('movimentacoes')
      .select('*')
      .order('data', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (let i = 0; i < data.length; i++) all.push(data[i]);
    if (data.length < PAGE || all.length >= limit) break;
    from += PAGE;
  }

  // Remove duplicatas pelo id (proteção contra paginação instável ou rows duplicados no banco)
  const seen = new Set<string>();
  const unique: Movimentacao[] = [];
  for (let i = 0; i < all.length; i++) {
    if (!seen.has(all[i].id)) {
      seen.add(all[i].id);
      unique.push(all[i]);
    }
  }
  return unique;
}

export async function getMovimentacoesBySiengeResource(
  resourceId: number,
  detailId: number | null,
): Promise<Movimentacao[]> {
  const PAGE = 50;
  const all: Movimentacao[] = [];
  let from = 0;

  for (let guard = 0; guard < 500; guard++) {
    let q = supabase
      .from('movimentacoes')
      .select('*')
      .eq('sienge_resource_id', resourceId)
      .order('data', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (detailId != null) q = q.eq('sienge_detail_id', detailId);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (let i = 0; i < data.length; i++) all.push(data[i]);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  return all;
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
  const PAGE = 50;

  // Total de insumos cadastrados (count preciso, não limitado por max-rows)
  const { count: totalCount } = await supabase
    .from('insumos')
    .select('*', { count: 'exact', head: true });
  const totalInsumos = totalCount ?? 0;

  // Soma total das quantidades — pagina para superar o limite de 1000 do servidor
  let totalQtd = 0;
  let from = 0;
  for (let guard = 0; guard < 1000; guard++) {
    const { data } = await supabase
      .from('insumos')
      .select('quantidade_atual')
      .range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    for (let i = 0; i < data.length; i++) totalQtd += data[i].quantidade_atual || 0;
    if (data.length < PAGE) break;
    from += PAGE;
  }

  // Insumo com mais saídas (pagina movimentacoes também)
  const freq: Record<string, number> = {};
  from = 0;
  for (let guard = 0; guard < 500; guard++) {
    const { data } = await supabase
      .from('movimentacoes')
      .select('insumo_nome')
      .eq('tipo', 'saida')
      .range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    for (let i = 0; i < data.length; i++) {
      const nome = data[i].insumo_nome;
      freq[nome] = (freq[nome] ?? 0) + 1;
    }
    if (data.length < PAGE) break;
    from += PAGE;
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
