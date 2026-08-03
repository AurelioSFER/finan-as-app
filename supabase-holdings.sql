-- =============================================================
--  Património — investimentos + fundo de emergência
--  Corre no Supabase (SQL Editor)
-- =============================================================

create table if not exists public.holdings (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  kind       text not null default 'investimento' check (kind in ('investimento','fundo_emergencia')),
  platform   text,
  value      numeric(12,2) not null default 0,
  goal       numeric(12,2),
  updated_at timestamptz not null default now()
);

alter table public.holdings enable row level security;

drop policy if exists "holdings_all" on public.holdings;
create policy "holdings_all" on public.holdings
  for all to authenticated using (true) with check (true);
