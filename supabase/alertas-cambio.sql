-- Alerta de câmbio (4º tipo, igual preço/clima/leilão) — pedido do Matheus
-- 2026-10-12 depois do bug de "alerta de dólar" não existir. Mesmo formato
-- de alertas_preco (sem cultura/uf, câmbio é nacional, um valor só).
create table public.alertas_cambio (
  id uuid primary key default gen_random_uuid(),
  produtor_id uuid not null references public.produtores(id) on delete cascade,
  criado_por uuid references auth.users(id) on delete cascade,
  limite numeric not null,
  direcao text not null check (direcao in ('acima', 'abaixo')),
  ativo boolean not null default true,
  disparado_em timestamptz,
  whatsapp_destino text not null,
  created_at timestamptz not null default now()
);

alter table public.alertas_cambio enable row level security;

create policy "ve alertas de cambio dos produtores visiveis" on public.alertas_cambio
  for select using (
    produtor_id in (
      select id from public.produtores
      where user_id = auth.uid() or cooperativa_id in (select public.minhas_cooperativas())
    )
  );

create policy "cria/edita alertas de cambio dos produtores visiveis" on public.alertas_cambio
  for all using (
    produtor_id in (
      select id from public.produtores
      where user_id = auth.uid() or cooperativa_id in (select public.minhas_cooperativas())
    )
  );

-- scripts com service_role key (bot, GitHub Actions) sempre ignoram RLS.
