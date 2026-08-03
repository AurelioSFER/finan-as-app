# Finanças — Aurélio & Francisca

App web para lançarem e analisarem os gastos do casal. Login por link mágico (email),
base de dados na nuvem (persiste para sempre), gráficos ao vivo. Tu e a Francisca veem os
mesmos dados de qualquer telemóvel ou computador.

**Stack:** Next.js 14 (App Router) · Supabase (Postgres + Auth) · Recharts. Tudo em plano gratuito.

---

## O que precisas
- **Node.js 18+** instalado ([nodejs.org](https://nodejs.org)).
- Uma conta **Supabase** (grátis) e uma conta **Vercel** (grátis) para pôr online.

---

## Passo 1 — Base de dados (Supabase)
1. Cria um projeto em [supabase.com](https://supabase.com) → **New project** (guarda a password da BD).
2. No projeto: **SQL Editor → New query** → cola o conteúdo de [`supabase-schema.sql`](./supabase-schema.sql) → **Run**.
3. **Project Settings → API** → copia o **Project URL** e a **anon public key**.
4. **Authentication → Providers → Email**: garante que está **ativo** (o "magic link" usa isto).

## Passo 2 — Correr no teu computador
```bash
npm install
copy .env.local.example .env.local   # (no Mac/Linux: cp)
```
Abre `.env.local` e preenche:
```
NEXT_PUBLIC_SUPABASE_URL=https://XXXX.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```
Depois:
```bash
npm run dev
```
Abre **http://localhost:3000**, escreve o teu email, recebes o link, clicas → entras.

> Para a Francisca ter acesso, ela só precisa de fazer login com o email dela na mesma app.
> Como é uma app privada vossa, ambos partilham os mesmos registos.

## Passo 3 — Pôr online (Vercel)
1. Sobe este projeto para um repositório GitHub (privado).
2. Em [vercel.com](https://vercel.com) → **Add New → Project** → importa o repositório.
3. Em **Environment Variables**, mete as mesmas duas variáveis do `.env.local`.
4. **Deploy**. Ficas com um endereço tipo `https://financas-xxxx.vercel.app`.
5. Volta ao Supabase → **Authentication → URL Configuration**:
   - **Site URL:** `https://financas-xxxx.vercel.app`
   - **Redirect URLs:** adiciona `https://financas-xxxx.vercel.app/auth/callback` **e** `http://localhost:3000/auth/callback`.

Pronto — instalam no telemóvel como atalho e usam todos os dias.

---

## Como se usa
- **Gastos:** lança cada movimento (data, valor, categoria, conta).
  - **Flag R** = reembolsado (recebes de volta) → não conta como gasto real.
  - **Flag P** = prenda → separado dos teus gastos de estilo de vida.
  - **Importar vários:** cola linhas do extrato de uma vez (`data ; descrição ; valor ; categoria ; conta ; kind ; flag ; notas`).
- **Dashboard:** escolhe o mês e vê os totais, o gráfico por categoria e os movimentos recentes.

## Personalizar
- As **categorias e contas** editam-se num sítio só: [`lib/categories.ts`](./lib/categories.ts).

## Notas
- **Privacidade:** os dados vivem no *teu* projeto Supabase, protegidos por login. Modelo simples de casal:
  qualquer utilizador autenticado partilha os mesmos registos (definido nas políticas RLS do schema).
- **Banco automático:** esta versão é de lançamento manual / colar do extrato. Ligar o banco a puxar
  movimentos sozinho exige uma integração de Open Banking (ex.: GoCardless) — dá para acrescentar depois.
