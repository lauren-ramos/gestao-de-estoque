-- Migration: adiciona colunas Sienge nas tabelas existentes
-- Execute no Supabase SQL Editor antes de usar a sincronização

ALTER TABLE insumos
  ADD COLUMN IF NOT EXISTS sienge_resource_id INTEGER,
  ADD COLUMN IF NOT EXISTS sienge_detail_id   INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS insumos_sienge_unique
  ON insumos (sienge_resource_id, sienge_detail_id)
  WHERE sienge_resource_id IS NOT NULL;

ALTER TABLE movimentacoes
  ADD COLUMN IF NOT EXISTS sienge_movement_id  INTEGER,
  ADD COLUMN IF NOT EXISTS sienge_resource_id  INTEGER,
  ADD COLUMN IF NOT EXISTS sienge_detail_id    INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS movimentacoes_sienge_unique
  ON movimentacoes (sienge_movement_id)
  WHERE sienge_movement_id IS NOT NULL;
