const BASE_URL = process.env.EXPO_PUBLIC_SIENGE_BASE_URL ?? 'https://api.sienge.com.br';
const SUBDOMAIN = process.env.EXPO_PUBLIC_SIENGE_SUBDOMAIN ?? '';
const USUARIO = process.env.EXPO_PUBLIC_SIENGE_USUARIO ?? '';
const SENHA = process.env.EXPO_PUBLIC_SIENGE_SENHA ?? '';

// Mantido apenas para compatibilidade com sync.ts legado (movimentações)
export const COST_CENTER_IDS: number[] = (process.env.EXPO_PUBLIC_SIENGE_COST_CENTER_IDS ?? '1')
  .split(',')
  .map((s: string) => Number(s.trim()))
  .filter(Boolean);

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface SiengeResource {
  resourceId: number;
  resourceName: string;        // nome base do insumo
  detailId: number | null;
  detailDescription: string | null; // descrição do detalhe
  code: string;                // "resourceId.detailId" ou "resourceId"
  name: string;                // nome completo para display
  unit: string;
  quantity: number;
  costCenterId: number;
}

export interface SiengeMovimentacao {
  id: number;
  tipo: 'entrada' | 'saida';
  tipoDescricao: string;
  quantidade: number;
  data: string;
  documento: string;
  fornecedor: string;
  costCenterId: number;
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

function hasCredentials(): boolean {
  return Boolean(SUBDOMAIN && USUARIO && SENHA);
}

function apiUrl(path: string): string {
  return `${BASE_URL}/${SUBDOMAIN}/public/api/v1${path}`;
}

function bulkDataUrl(path: string): string {
  return `${BASE_URL}/${SUBDOMAIN}/public/api/bulk-data/v1${path}`;
}

function authHeader(): Record<string, string> {
  const credentials = btoa(`${USUARIO}:${SENHA}`);
  return { Authorization: `Basic ${credentials}` };
}

async function getRequest<T>(path: string): Promise<T | null> {
  if (!hasCredentials()) {
    console.warn('[Sienge] Credenciais não configuradas — busca desativada.');
    return null;
  }
  const res = await fetch(apiUrl(path), { headers: authHeader() });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sienge ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function postRequest(path: string, body: unknown): Promise<void> {
  if (!hasCredentials()) {
    console.warn('[Sienge] Credenciais não configuradas — sincronização desativada.');
    return;
  }
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sienge ${res.status}: ${text}`);
  }
}

function extractArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.results)) return obj.results as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

// ─── Insumos via bulk-data (por obra/building) ───────────────────────────────

// Campos retornados pelo endpoint /bulk-data/v1/building/resources (confirmados por log)
interface BulkResourceItem {
  id?: number;
  description?: string;        // nome do insumo
  unitOfMeasure?: string;
  detailId?: number | null;
  detailDescription?: string | null;
  isActive?: boolean;
  // Fallbacks para compatibilidade
  resourceId?: number;
  resourceName?: string;
  name?: string;
  unit?: string;
}

const BULK_PARAMS = 'startDate=2020-01-01&endDate=2050-12-31&includeDisbursement=false&bdi=0.00&laborBurden=0.00';

let _cachedInsumos: SiengeResource[] | null = null;

export function clearInsumosCache(): void {
  _cachedInsumos = null;
}

export async function getInsumosFromSienge(forceRefresh = false): Promise<SiengeResource[]> {
  if (!hasCredentials()) return [];
  if (_cachedInsumos && !forceRefresh) return _cachedInsumos;

  const all: SiengeResource[] = [];
  let buildingId = 1;
  let consecutiveEmpty = 0;
  const MAX_EMPTY = 3; // para após 3 obras consecutivas sem dados

  while (consecutiveEmpty < MAX_EMPTY && buildingId <= 500) {
    try {
      const url = `${bulkDataUrl('/building/resources')}?buildingId=${buildingId}&${BULK_PARAMS}`;
      const res = await fetch(url, { headers: authHeader() });

      if (res.status === 404) {
        consecutiveEmpty++;
        buildingId++;
        continue;
      }
      if (!res.ok) {
        throw new Error(`Sienge ${res.status}`);
      }

      const data = await res.json();
      const items = extractArray<BulkResourceItem>(data);

      if (items.length === 0) {
        consecutiveEmpty++;
        buildingId++;
        continue;
      }

      consecutiveEmpty = 0; // encontrou dados, reseta o contador

      for (let j = 0; j < items.length; j++) {
        const item = items[j];
        // Campos confirmados pelo log da API bulk-data:
        // id → resourceId | description → nome | detailId | detailDescription | unitOfMeasure
        // Obs: não há campo de quantidade neste endpoint (é orçamento, não estoque)
        const resourceId = item.id ?? item.resourceId ?? 0;
        const resourceName = (item.description ?? item.resourceName ?? item.name ?? '').trim();
        const detailId = item.detailId ?? null;
        const detailDescription = item.detailDescription?.trim() ?? null;
        const quantity = 0; // bulk-data não retorna quantidade de estoque
        const unit = item.unitOfMeasure ?? item.unit ?? '';

        all.push({
          resourceId,
          resourceName,
          detailId,
          detailDescription,
          code: detailId != null ? `${resourceId}.${detailId}` : String(resourceId),
          name: detailDescription ? `${resourceName} - ${detailDescription}` : resourceName,
          unit,
          quantity,
          costCenterId: buildingId,
        });
      }

      buildingId++;
    } catch (err) {
      if (String(err).includes('404')) {
        consecutiveEmpty++;
      } else {
        console.warn(`[Sienge] Falha ao buscar obra ${buildingId}:`, err);
        consecutiveEmpty++;
      }
      buildingId++;
    }
  }

  // Agrega por code: soma quantidades entre obras
  const map = new Map<string, SiengeResource>();
  for (let i = 0; i < all.length; i++) {
    const r = all[i];
    const existing = map.get(r.code);
    if (existing) {
      existing.quantity += r.quantity;
    } else {
      map.set(r.code, { ...r });
    }
  }

  const result = Array.from(map.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR'),
  );
  _cachedInsumos = result;
  return result;
}

export function getResourceDetails(resourceId: number): SiengeResource[] {
  if (!_cachedInsumos) return [];
  return _cachedInsumos.filter((r) => r.resourceId === resourceId);
}

// ─── Movimentações de Estoque ─────────────────────────────────────────────────

interface SiengeMovRaw {
  id: number;
  documentId?: string;
  movementNumber?: number;
  movementTypeDescription?: string;
  inputOutput: 'INPUT' | 'OUTPUT' | string;
  movementDate: string | Record<string, unknown>;
  costCenterId?: number;
  resourceId: number;
  detailId?: number | null;
  movementQuantity: number;
  supplierName?: string;
}

interface PaginatedResponse<T> {
  results: T[];
  resultSetMetadata?: { count: number; offset: number; limit: number };
}

function parseMovDate(movementDate: string | Record<string, unknown>): string {
  if (typeof movementDate === 'string') return movementDate;
  // Sienge às vezes retorna { year, monthValue, dayOfMonth }
  const d = movementDate as Record<string, number>;
  if (d.year && d.monthValue && d.dayOfMonth) {
    const m = String(d.monthValue).padStart(2, '0');
    const day = String(d.dayOfMonth).padStart(2, '0');
    return `${d.year}-${m}-${day}`;
  }
  return String(movementDate);
}

export async function getSiengeMovimentos(
  resourceId: number,
  detailId?: number | null,
): Promise<SiengeMovimentacao[]> {
  if (!hasCredentials()) return [];

  const all: SiengeMovRaw[] = [];
  const LIMIT = 200;

  for (let i = 0; i < COST_CENTER_IDS.length; i++) {
    const costCenterId = COST_CENTER_IDS[i];
    try {
      // A API não filtra por resourceId — pagina tudo e filtra client-side
      let offset = 0;
      let total = Infinity;

      while (offset < total) {
        const raw = await getRequest<unknown>(
          `/inventory-movements?costCenterId=${costCenterId}&limit=${LIMIT}&offset=${offset}`,
        );
        if (!raw) break;

        const meta = (raw as Record<string, unknown>).resultSetMetadata as
          | { count: number }
          | undefined;
        if (meta?.count != null) total = meta.count;

        const items = extractArray<SiengeMovRaw>(raw);
        if (items.length === 0) break;

        for (let j = 0; j < items.length; j++) {
          const m = items[j];
          if (m.resourceId !== resourceId) continue;
          if (detailId != null && m.detailId != null && m.detailId !== detailId) continue;
          all.push(m);
        }

        offset += items.length;
        if (items.length < LIMIT) break; // última página
      }
    } catch (err) {
      if (!String(err).includes('404')) {
        console.warn(`[Sienge] Falha ao buscar movimentações centro ${costCenterId}:`, err);
      }
    }
  }

  const result: SiengeMovimentacao[] = [];
  for (let i = 0; i < all.length; i++) {
    const m = all[i];
    result.push({
      id: m.id,
      tipo: m.inputOutput === 'INPUT' ? 'entrada' : 'saida',
      tipoDescricao: m.movementTypeDescription ?? (m.inputOutput === 'INPUT' ? 'Entrada' : 'Saída'),
      quantidade: m.movementQuantity,
      data: parseMovDate(m.movementDate),
      documento: [m.documentId, m.movementNumber].filter(Boolean).join(' / '),
      fornecedor: m.supplierName ?? '',
      costCenterId: m.costCenterId ?? 0,
    });
  }

  result.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  return result;
}

// ─── Criação de Movimentos ────────────────────────────────────────────────────

export interface SiengeMovimentoPayload {
  costCenterId: number;
  resourceId: number;
  type: 'E' | 'S';
  quantity: number;
  date: string;
  observation?: string;
}

export async function sincronizarMovimento(mov: SiengeMovimentoPayload): Promise<void> {
  await postRequest('/stock-movements', mov);
}

/** @deprecated */
export async function sincronizarMovimentoLegado(_mov: Record<string, unknown>): Promise<void> {
  console.warn('[Sienge] sincronizarMovimentoLegado: endpoint antigo. Use sincronizarMovimento.');
}
