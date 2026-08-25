-- Lista de acompanhamento do produtor (plano Ouro): culturas/UFs além da
-- principal dele, pra comparar preço de outra região ou diversificação.
create table public.produtor_watchlist (
  id uuid primary key default gen_random_uuid(),
  produtor_id uuid not null references public.produtores(id) on delete cascade,
  cultura text not null,
  uf text not null,
  created_at timestamptz not null default now(),
  unique (produtor_id, cultura, uf)
);

alter table public.produtor_watchlist enable row level security;

create policy "produtor ve sua watchlist" on public.produtor_watchlist
  for select using (produtor_id in (select id from public.produtores where user_id = auth.uid()));

create policy "produtor gerencia sua watchlist" on public.produtor_watchlist
  for all using (produtor_id in (select id from public.produtores where user_id = auth.uid()));
