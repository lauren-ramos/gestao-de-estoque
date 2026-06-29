-- Migration v2: adiciona sienge_code como chave de upsert

-- Insumos
ALTER TABLE insumos
  ADD COLUMN IF NOT EXISTS sienge_resource_id INTEGER,
  ADD COLUMN IF NOT EXISTS sienge_detail_id   INTEGER,
  ADD COLUMN IF NOT EXISTS sienge_code        TEXT;

-- Remove índice parcial antigo (se existir) e cria constraint UNIQUE real
DROP INDEX IF EXISTS insumos_sienge_unique;

DO $$ BEGIN
  ALTER TABLE insumos ADD CONSTRAINT insumos_sienge_code_unique UNIQUE (sienge_code);
EXCEPTION WHEN duplicate_table THEN NULL;
             WHEN others        THEN NULL;
END $$;

-- Movimentacoes
ALTER TABLE movimentacoes
  ADD COLUMN IF NOT EXISTS sienge_movement_id INTEGER,
  ADD COLUMN IF NOT EXISTS sienge_resource_id INTEGER,
  ADD COLUMN IF NOT EXISTS sienge_detail_id   INTEGER;

-- Remove índice parcial antigo e cria constraint UNIQUE real
DROP INDEX IF EXISTS movimentacoes_sienge_unique;

DO $$ BEGIN
  ALTER TABLE movimentacoes ADD CONSTRAINT movimentacoes_sienge_movement_id_unique UNIQUE (sienge_movement_id);
EXCEPTION WHEN duplicate_table THEN NULL;
             WHEN others        THEN NULL;
END $$;
