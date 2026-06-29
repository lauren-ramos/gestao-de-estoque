import { getInsumosFromSienge, clearInsumosCache, COST_CENTER_IDS, type SiengeResource, type SiengeMovimentacao } from './sienge';
import { syncSiengeInsumos, syncSiengeMovimentos } from './database';

export type SyncProgressCallback = (msg: string, current: number, total: number) => void;

export interface SyncResult {
  insumos: number;
  movimentos: number;
  erros: string[];
}

// ─── Busca todas as movimentações de um centro de custo (paginado) ────────────

const BASE_URL = process.env.EXPO_PUBLIC_SIENGE_BASE_URL ?? 'https://api.sienge.com.br';
const SUBDOMAIN = process.env.EXPO_PUBLIC_SIENGE_SUBDOMAIN ?? '';
const USUARIO   = process.env.EXPO_PUBLIC_SIENGE_USUARIO ?? '';
const SENHA     = process.env.EXPO_PUBLIC_SIENGE_SENHA ?? '';

function authHeader() {
  return { Authorization: `Basic ${btoa(`${USUARIO}:${SENHA}`)}` };
}

interface RawMov {
  id: number;
  inputOutput: string;
  movementDate: string | Record<string, number>;
  movementTypeDescription?: string;
  resourceId: number;
  detailId?: number | null;
  movementQuantity: number;
  documentId?: string;
  movementNumber?: number;
  supplierName?: string;
  costCenterId?: number;
}

interface PaginatedResponse { results: RawMov[]; resultSetMetadata?: { count: number } }

function parseDate(d: string | Record<string, number>): string {
  if (typeof d === 'string') return d;
  if (d.year && d.monthValue && d.dayOfMonth) {
    return `${d.year}-${String(d.monthValue).padStart(2, '0')}-${String(d.dayOfMonth).padStart(2, '0')}`;
  }
  return String(d);
}

async function fetchAllMovsForCostCenter(
  costCenterId: number,
  onPage: (fetched: number, total: number) => void,
): Promise<Map<string, SiengeMovimentacao[]>> {
  const grouped = new Map<string, SiengeMovimentacao[]>();
  const LIMIT = 200;
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const url = `${BASE_URL}/${SUBDOMAIN}/public/api/v1/inventory-movements?costCenterId=${costCenterId}&limit=${LIMIT}&offset=${offset}`;
    const res = await fetch(url, { headers: authHeader() });
    if (!res.ok) throw new Error(`Sienge ${res.status}`);

    const data: PaginatedResponse = await res.json();
    if (data.resultSetMetadata?.count != null) total = data.resultSetMetadata.count;

    const items = data.results ?? [];
    if (items.length === 0) break;

    for (let i = 0; i < items.length; i++) {
      const m = items[i];
      const key = `${m.resourceId}.${m.detailId != null ? m.detailId : ''}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push({
        id: m.id,
        tipo: m.inputOutput === 'INPUT' ? 'entrada' : 'saida',
        tipoDescricao: m.movementTypeDescription ?? (m.inputOutput === 'INPUT' ? 'Entrada' : 'Saída'),
        quantidade: m.movementQuantity,
        data: parseDate(m.movementDate),
        documento: [m.documentId, m.movementNumber].filter(Boolean).join(' / '),
        fornecedor: m.supplierName ?? '',
        costCenterId: m.costCenterId ?? costCenterId,
      });
    }

    offset += items.length;
    onPage(Math.min(offset, total), total);
    if (items.length < LIMIT) break;
  }

  return grouped;
}

// ─── Sync completo Sienge → Supabase ─────────────────────────────────────────

export async function syncAllFromSienge(onProgress: SyncProgressCallback): Promise<SyncResult> {
  const erros: string[] = [];
  let totalMovimentos = 0;

  // 1. Insumos
  onProgress('Buscando insumos do Sienge...', 0, 100);
  clearInsumosCache();
  const insumos = await getInsumosFromSienge(true);

  onProgress(`Salvando ${insumos.length} insumos...`, 10, 100);
  await syncSiengeInsumos(insumos);

  // Índice rápido: "resourceId.detailId" → SiengeResource
  const insumoMap = new Map<string, SiengeResource>();
  for (let ri = 0; ri < insumos.length; ri++) {
    const r = insumos[ri];
    insumoMap.set(`${r.resourceId}.${r.detailId != null ? r.detailId : ''}`, r);
  }

  // 2. Movimentações por centro de custo
  const totalCC = COST_CENTER_IDS.length;
  onProgress(`Buscando movimentações (${totalCC} centro${totalCC > 1 ? 's' : ''} de custo)...`, 10, 100);

  for (let ci = 0; ci < totalCC; ci++) {
    const costCenterId = COST_CENTER_IDS[ci];
    const baseProgress = 10 + Math.round((ci / totalCC) * 85);

    try {
      const grouped = await fetchAllMovsForCostCenter(costCenterId, (fetched, total) => {
        const pct = baseProgress + Math.round((fetched / total) * (85 / totalCC));
        onProgress(`CC ${costCenterId}: ${fetched}/${total} movimentações...`, pct, 100);
      });

      // Hermes: não suporta for...of em Map — usa Array.from
      const entries = Array.from(grouped.entries());
      for (let ei = 0; ei < entries.length; ei++) {
        const key = entries[ei][0];
        const movs = entries[ei][1];
        const resource = insumoMap.get(key);
        if (!resource) continue;
        await syncSiengeMovimentos(movs, resource.name, resource.resourceId, resource.detailId);
        totalMovimentos += movs.length;
      }
    } catch (err) {
      const msg = `Centro de custo ${costCenterId}: ${String(err)}`;
      erros.push(msg);
      console.warn('[Sync]', msg);
    }
  }

  onProgress('Sincronização concluída!', 100, 100);
  return { insumos: insumos.length, movimentos: totalMovimentos, erros };
}
