const BASE_URL = process.env.EXPO_PUBLIC_SIENGE_BASE_URL ?? 'https://api.sienge.com.br';
const SUBDOMAIN = process.env.EXPO_PUBLIC_SIENGE_SUBDOMAIN ?? '';
const USUARIO = process.env.EXPO_PUBLIC_SIENGE_USUARIO ?? '';
const SENHA = process.env.EXPO_PUBLIC_SIENGE_SENHA ?? '';

const COST_CENTER_IDS: number[] = (process.env.EXPO_PUBLIC_SIENGE_COST_CENTER_IDS ?? '1')
  .split(',')
  .map((s) => Number(s.trim()))
  .filter(Boolean);

// Exporta para uso em outros módulos
export { COST_CENTER_IDS };

console.log(`[Sienge] Centros de custo configurados: ${COST_CENTER_IDS.join(', ')}`);
console.log('[Sienge] Para buscar mais obras, adicione os IDs em EXPO_PUBLIC_SIENGE_COST_CENTER_IDS no .env');

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

// ─── Estoque de Insumos ───────────────────────────────────────────────────────

interface StockItem {
  resourceId: number;
  resourceName: string;
  detailId?: number | null;
  detailDescription?: string | null;
  quantity: number;
  unitOfMeasure: string;
}

let _cachedInsumos: SiengeResource[] | null = null;

export function clearInsumosCache(): void {
  _cachedInsumos = null;
}

export async function getInsumosFromSienge(forceRefresh = false): Promise<SiengeResource[]> {
  if (!hasCredentials()) return [];
  if (_cachedInsumos && !forceRefresh) return _cachedInsumos;

  const all: SiengeResource[] = [];
  const LIMIT = 500; // limite alto para reduzir chamadas

  for (let i = 0; i < COST_CENTER_IDS.length; i++) {
    const costCenterId = COST_CENTER_IDS[i];
    try {
      let offset = 0;
      let total = Infinity;

      while (offset < total) {
        const raw = await getRequest<unknown>(
          `/stock-inventories/${costCenterId}/items?limit=${LIMIT}&offset=${offset}`,
        );
        if (!raw) break;

        const meta = (raw as Record<string, unknown>).resultSetMetadata as
          | { count: number }
          | undefined;
        if (meta?.count != null) total = meta.count;

        const items = extractArray<StockItem>(raw);
        if (items.length === 0) break;

        for (let j = 0; j < items.length; j++) {
          const item = items[j];
          const detailId = item.detailId ?? null;
          const resourceName = item.resourceName.trim();
          const detailDescription = item.detailDescription?.trim() ?? null;

          all.push({
            resourceId: item.resourceId,
            resourceName,
            detailId,
            detailDescription,
            code: detailId != null
              ? `${item.resourceId}.${detailId}`
              : String(item.resourceId),
            name: detailDescription
              ? `${resourceName} - ${detailDescription}`
              : resourceName,
            unit: item.unitOfMeasure,
            quantity: item.quantity,
            costCenterId,
          });
        }

        offset += items.length;
        if (items.length < LIMIT) break;
      }
    } catch (err) {
      console.warn(`[Sienge] Falha ao buscar centro de custo ${costCenterId}:`, err);
    }
  }

  // Agrega por code: soma quantidades entre centros de custo
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
      console.warn(`[Sienge] Falha ao buscar movimentações centro ${costCenterId}:`, err);
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
