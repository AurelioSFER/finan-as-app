-- =============================================================
--  Finanças — Aurélio & Francisca
--  Executa isto uma vez no Supabase:
--  Dashboard -> SQL Editor -> New query -> cola tudo -> Run
-- =============================================================

create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date        date not null,
  description text not null,
  amount      numeric(10,2) not null check (amount >= 0),
  kind        text not null default 'gasto' check (kind in ('gasto','entrada')),
  category    text not null default 'Outros',
  account     text not null default 'Caixa',
  flag        text check (flag in ('R','P')),   -- R = reembolsado, P = prenda
  notes       text,
  created_at  timestamptz not null default now()
);

alter table public.expenses enable row level security;

-- App privada (tu + Francisca): qualquer utilizador autenticado partilha os mesmos registos.
drop policy if exists "shared_select" on public.expenses;
create policy "shared_select" on public.expenses for select to authenticated using (true);

drop policy if exists "shared_insert" on public.expenses;
create policy "shared_insert" on public.expenses for insert to authenticated with check (true);

drop policy if exists "shared_update" on public.expenses;
create policy "shared_update" on public.expenses for update to authenticated using (true) with check (true);

drop policy if exists "shared_delete" on public.expenses;
create policy "shared_delete" on public.expenses for delete to authenticated using (true);

create index if not exists expenses_date_idx on public.expenses (date desc);
