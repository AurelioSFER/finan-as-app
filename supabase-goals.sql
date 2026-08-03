-- =============================================================
--  Objetivos / Metas de poupança
--  Corre no Supabase (SQL Editor)
-- =============================================================

create table if not exists public.goals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  emoji      text not null default '🎯',
  target     numeric(12,2) not null default 0,
  saved      numeric(12,2) not null default 0,
  deadline   date,
  -- 'manual'        -> o poupado é o campo `saved`
  -- 'fundo'         -> o poupado vem do fundo de emergência (Património)
  -- 'investimentos' -> o poupado vem do total das posições (Património)
  source     text not null default 'manual' check (source in ('manual','fundo','investimentos')),
  space      text not null default 'pessoal' check (space in ('pessoal','conjunta')),
  note       text,
  done       boolean not null default false,
  sort       int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists goals_space_idx on public.goals (space, done, sort);

alter table public.goals enable row level security;

drop policy if exists "goals_all" on public.goals;
create policy "goals_all" on public.goals
  for all to authenticated using (true) with check (true);
