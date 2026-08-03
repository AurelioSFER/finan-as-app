-- =============================================================
--  Plano / Orçamento — valores planeados por tipo
--  Corre no Supabase (SQL Editor)
-- =============================================================

create table if not exists public.budgets (
  key        text primary key,           -- 'rendimento' | 'Fixos' | 'Necessários' | 'Supérfluos' | 'Poupança'
  planned    numeric(12,2) not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.budgets enable row level security;

drop policy if exists "budgets_all" on public.budgets;
create policy "budgets_all" on public.budgets
  for all to authenticated using (true) with check (true);
