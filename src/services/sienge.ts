/**
 * Sienge API integration — stock movement sync.
 *
 * Configure EXPO_PUBLIC_SIENGE_BASE_URL and EXPO_PUBLIC_SIENGE_TOKEN
 * in your .env.local to activate real sync. Without them the service
 * logs a warning and returns without failing, so the app still works offline.
 */

const BASE_URL = process.env.EXPO_PUBLIC_SIENGE_BASE_URL;
const TOKEN = process.env.EXPO_PUBLIC_SIENGE_TOKEN;

interface SiengeMovimento {
  codigoInsumo: string;
  descricao: string;
  tipo: 'entrada' | 'saida';
  quantidade: number;
  data: string;
  notaFiscal?: string;
  recebidoPor?: string;
  observacao?: string;
}

async function request(path: string, body: unknown): Promise<void> {
  if (!BASE_URL || !TOKEN) {
    console.warn('[Sienge] Credenciais não configuradas — sincronização desativada.');
    return;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sienge error ${res.status}: ${text}`);
  }
}

export async function sincronizarMovimento(mov: SiengeMovimento): Promise<void> {
  await request('/api/v1/estoque/movimentacoes', mov);
}

export async function sincronizarEntradaOC(
  numeroOC: string,
  itens: Array<{ codigoInsumo: string; quantidade: number; valorTotal?: number }>,
): Promise<void> {
  await request('/api/v1/estoque/ordens-compra/entrada', { numeroOC, itens });
}
