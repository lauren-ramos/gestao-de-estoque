export type MovementType = 'entrada' | 'saida';

export interface Insumo {
  id: string;
  nome: string;
  detalhe?: string;
  quantidade_atual: number;
  sienge_resource_id?: number;
  sienge_detail_id?: number;
  sienge_code?: string;
  created_at: string;
  updated_at: string;
}

export interface Movimentacao {
  id: string;
  insumo_id: string;
  insumo_nome: string;
  tipo: MovementType;
  quantidade: number;
  data: string;
  observacao?: string;
  foto_url?: string;
  nota_fiscal_url?: string;
  recebido_por?: string;
  oc_id?: string;
  created_at: string;
}

export interface OrdemCompra {
  id: string;
  numero: string;
  status: 'pendente' | 'conferido' | 'erro';
  created_at: string;
}

export interface ItemOC {
  id: string;
  oc_id: string;
  insumo: string;
  detalhe?: string;
  quantidade: number;
  valor_total?: number;
  observacao?: string;
  foto_url?: string;
  nota_fiscal_url?: string;
  recebido_por?: string;
}

export interface ErroOC {
  id: string;
  oc_id: string;
  descricao: string;
  foto_url?: string;
  nota_fiscal_url?: string;
  recebido_por?: string;
  created_at: string;
}

export interface DashboardStats {
  totalInsumos: number;
  insumoMaisUtilizado: string;
  produtosNoEstoque: number;
}

export interface WeeklyData {
  labels: string[];
  entradas: number[];
  saidas: number[];
}
