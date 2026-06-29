import { getInsumosFromSienge, clearInsumosCache, type SiengeResource, type SiengeMovimentacao } from './sienge';
import { syncSiengeInsumos, syncSiengeMovimentos } from './database';

export type SyncProgressCallback = (msg: string, current: number, total: number) => void;

export interface SyncResult {
  insumos: number;
  movimentos: number;
  erros: string[];
}

// ─── Credenciais ──────────────────────────────────────────────────────────────

const BASE_URL = process.env.EXPO_PUBLIC_SIENGE_BASE_URL ?? 'https://api.sienge.com.br';
const SUBDOMAIN = process.env.EXPO_PUBLIC_SIENGE_SUBDOMAIN ?? '';
const USUARIO   = process.env.EXPO_PUBLIC_SIENGE_USUARIO ?? '';
const SENHA     = process.env.EXPO_PUBLIC_SIENGE_SENHA ?? '';

function authHeader() {
  return { Authorization: `Basic ${btoa(`${USUARIO}:${SENHA}`)}` };
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

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

// ─── Busca global de movimentações (sem filtro de centro de custo) ────────────

async function fetchAllMovsGlobal(
  onPage: (fetched: number, total: number) => void,
): Promise<Map<string, SiengeMovimentacao[]>> {
  const grouped = new Map<string, SiengeMovimentacao[]>();
  const LIMIT = 100;
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const url = `${BASE_URL}/${SUBDOMAIN}/public/api/v1/inventory-movements?limit=${LIMIT}&offset=${offset}`;
    const res = await fetch(url, { headers: authHeader() });
    if (!res.ok) throw new Error(`Sienge ${res.status}: ${await res.text()}`);

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
        costCenterId: m.costCenterId ?? 0,
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

  // 1. Insumos via bulk-data (itera obras 1, 2, 3... até 3 consecutivos sem dados)
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

  // 2. Movimentações — endpoint global, sem filtro por centro de custo
  onProgress('Buscando movimentações do Sienge...', 15, 100);

  try {
    const grouped = await fetchAllMovsGlobal((fetched, total) => {
      const pct = 15 + Math.round((fetched / total) * 80);
      onProgress(`Movimentações: ${fetched.toLocaleString('pt-BR')}/${total.toLocaleString('pt-BR')}...`, pct, 100);
    });

    onProgress('Salvando movimentações no banco...', 95, 100);

    // Hermes: usa Array.from em vez de for...of em Map
    const entries = Array.from(grouped.entries());
    for (let ei = 0; ei < entries.length; ei++) {
      const key = entries[ei][0];
      const movs = entries[ei][1];
      const resource = insumoMap.get(key);
      const nome = resource?.name ?? key;
      const resourceId = resource?.resourceId ?? Number(key.split('.')[0]);
      const detailId = resource?.detailId ?? (key.includes('.') ? Number(key.split('.')[1]) || null : null);
      await syncSiengeMovimentos(movs, nome, resourceId, detailId);
      totalMovimentos += movs.length;
    }
  } catch (err) {
    const msg = `Movimentações: ${String(err)}`;
    erros.push(msg);
    console.warn('[Sync]', msg);
  }

  onProgress('Sincronização concluída!', 100, 100);
  return { insumos: insumos.length, movimentos: totalMovimentos, erros };
}
