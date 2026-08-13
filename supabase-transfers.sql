-- =============================================================
--  Transferências entre contas tuas
--  Executa isto uma vez no Supabase:
--  Dashboard -> SQL Editor -> New query -> cola tudo -> Run
-- =============================================================

-- Destino do movimento. Preenchido só quando o dinheiro mudou de conta tua
-- (Caixa -> Revolut, Revolut -> Trade Republic, ...). Nesses casos o
-- movimento sai da conta de origem mas não é consumo: não conta como gasto.
alter table public.expenses
  add column if not exists to_account text;

-- Sem CHECK de propósito: as contas vivem em lib/categories.ts e mudam mais
-- vezes do que o schema. Mesma decisão que já está na coluna "account".

create index if not exists expenses_to_account_idx
  on public.expenses (to_account)
  where to_account is not null;
