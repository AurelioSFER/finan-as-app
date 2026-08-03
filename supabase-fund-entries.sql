-- =============================================================
--  Movimentos do fundo (juros / depósitos datados)
--  Corre no Supabase (SQL Editor)
-- =============================================================

create table if not exists public.fund_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date       date not null,
  amount     numeric(12,2) not null,
  note       text,
  created_at timestamptz not null default now()
);

alter table public.fund_entries enable row level security;

drop policy if exists "fund_entries_all" on public.fund_entries;
create policy "fund_entries_all" on public.fund_entries
  for all to authenticated using (true) with check (true);

create index if not exists fund_entries_date_idx on public.fund_entries (date desc);
