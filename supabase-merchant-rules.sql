-- =============================================================
--  Memória de categorias — corre isto no Supabase (SQL Editor)
--  Guarda "este comerciante -> esta categoria" para preencher sozinho
-- =============================================================

create table if not exists public.merchant_rules (
  key        text primary key,
  category   text not null,
  updated_at timestamptz not null default now()
);

alter table public.merchant_rules enable row level security;

drop policy if exists "mr_all" on public.merchant_rules;
create policy "mr_all" on public.merchant_rules
  for all to authenticated using (true) with check (true);
