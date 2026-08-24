-- Assinaturas: dona de uma cooperativa OU de um produtor solo (nunca os dois).
-- O status só é escrito pelo webhook do Stripe, que usa a service_role key
-- (ignora RLS) — por isso não existe policy de update/delete para usuário
-- autenticado abaixo, de propósito.
create table public.assinaturas (
  id uuid primary key default gen_random_uuid(),
  cooperativa_id uuid references public.cooperativas(id) on delete cascade,
  produtor_id uuid references public.produtores(id) on delete cascade,
  plano text not null check (plano in ('bronze', 'prata', 'ouro')),
  status text not null default 'trial' check (status in ('trial', 'ativa', 'inadimplente', 'cancelada')),
  trial_expira_em timestamptz not null default (now() + interval '7 days'),
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assinatura_um_dono check (
    (cooperativa_id is not null and produtor_id is null) or
    (cooperativa_id is null and produtor_id is not null)
  )
);

alter table public.assinaturas enable row level security;

create policy "dono ve sua assinatura" on public.assinaturas
  for select using (
    cooperativa_id in (select public.minhas_cooperativas())
    or produtor_id in (select id from public.produtores where user_id = auth.uid())
  );

-- Criada uma única vez, logo após o onboarding criar a cooperativa/produtor
-- (por isso o "with check" confere que o dono da nova linha é o próprio usuário).
create policy "usuario autenticado cria sua propria assinatura" on public.assinaturas
  for insert with check (
    cooperativa_id in (select public.minhas_cooperativas())
    or produtor_id in (select id from public.produtores where user_id = auth.uid())
  );
