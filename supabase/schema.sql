-- Gestão de Estoque — Supabase Schema
-- Run this in the Supabase SQL Editor to create all tables, policies, and storage buckets.

-- ── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Tables ──────────────────────────────────────────────────────────────────

create table if not exists insumos (
  id            uuid primary key default uuid_generate_v4(),
  nome          text not null,
  detalhe       text,
  quantidade_atual numeric(12,3) not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists ordens_compra (
  id         uuid primary key default uuid_generate_v4(),
  numero     text not null unique,
  status     text not null default 'pendente' check (status in ('pendente','conferido','erro')),
  created_at timestamptz not null default now()
);

create table if not exists movimentacoes (
  id              uuid primary key default uuid_generate_v4(),
  insumo_id       uuid references insumos(id) on delete set null,
  insumo_nome     text not null,
  tipo            text not null check (tipo in ('entrada','saida')),
  quantidade      numeric(12,3) not null,
  data            date not null,
  observacao      text,
  foto_url        text,
  nota_fiscal_url text,
  recebido_por    text,
  oc_id           uuid references ordens_compra(id) on delete set null,
  created_at      timestamptz not null default now()
);

create table if not exists itens_oc (
  id              uuid primary key default uuid_generate_v4(),
  oc_id           uuid not null references ordens_compra(id) on delete cascade,
  insumo          text not null,
  detalhe         text,
  quantidade      numeric(12,3) not null,
  valor_total     numeric(14,2),
  observacao      text,
  foto_url        text,
  nota_fiscal_url text,
  recebido_por    text,
  created_at      timestamptz not null default now()
);

create table if not exists erros_oc (
  id              uuid primary key default uuid_generate_v4(),
  oc_id           uuid not null references ordens_compra(id) on delete cascade,
  descricao       text not null,
  foto_url        text,
  nota_fiscal_url text,
  recebido_por    text,
  created_at      timestamptz not null default now()
);

-- ── Trigger: keep updated_at fresh on insumos ───────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger insumos_updated_at
  before update on insumos
  for each row execute function set_updated_at();

-- ── Trigger: update quantidade_atual after each movimentação ─────────────────
create or replace function sync_quantidade_insumo()
returns trigger language plpgsql as $$
begin
  if new.insumo_id is not null then
    update insumos
    set quantidade_atual = quantidade_atual +
      case when new.tipo = 'entrada' then new.quantidade else -new.quantidade end
    where id = new.insumo_id;
  end if;
  return new;
end;
$$;

create trigger movimentacoes_sync_qty
  after insert on movimentacoes
  for each row execute function sync_quantidade_insumo();

-- ── Row Level Security ───────────────────────────────────────────────────────
alter table insumos          enable row level security;
alter table ordens_compra    enable row level security;
alter table movimentacoes    enable row level security;
alter table itens_oc         enable row level security;
alter table erros_oc         enable row level security;

-- Allow authenticated users full access (adjust as needed for your auth model)
create policy "authenticated full access" on insumos
  for all using (auth.role() = 'authenticated');

create policy "authenticated full access" on ordens_compra
  for all using (auth.role() = 'authenticated');

create policy "authenticated full access" on movimentacoes
  for all using (auth.role() = 'authenticated');

create policy "authenticated full access" on itens_oc
  for all using (auth.role() = 'authenticated');

create policy "authenticated full access" on erros_oc
  for all using (auth.role() = 'authenticated');

-- ── Storage buckets ──────────────────────────────────────────────────────────
-- Run these in the Supabase Storage section or via the API:
--
-- insert into storage.buckets (id, name, public) values ('fotos', 'fotos', true);
-- insert into storage.buckets (id, name, public) values ('notas-fiscais', 'notas-fiscais', true);
