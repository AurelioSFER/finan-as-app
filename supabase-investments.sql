-- =============================================================
--  Investimentos — colunas extra na tabela holdings
--  Corre no Supabase (SQL Editor)
-- =============================================================

alter table public.holdings add column if not exists ticker   text;
alter table public.holdings add column if not exists quantity numeric(18,6);
alter table public.holdings add column if not exists invested numeric(12,2);
