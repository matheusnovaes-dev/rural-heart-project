create table public.alertas_preco (
  id uuid primary key default gen_random_uuid(),
  produtor_id uuid not null references public.produtores(id) on delete cascade,
  criado_por uuid not null references auth.users(id) on delete cascade,
  cultura text not null,
  uf text not null,
  limite numeric not null,
  direcao text not null check (direcao in ('acima', 'abaixo')),
  ativo boolean not null default true,
  disparado_em timestamptz,
  whatsapp_destino text not null,
  created_at timestamptz not null default now()
);

alter table public.alertas_preco enable row level security;

create policy "ve alertas dos produtores visiveis" on public.alertas_preco
  for select using (
    produtor_id in (
      select id from public.produtores
      where user_id = auth.uid() or cooperativa_id in (select public.minhas_cooperativas())
    )
  );

create policy "cria/edita alertas dos produtores visiveis" on public.alertas_preco
  for all using (
    produtor_id in (
      select id from public.produtores
      where user_id = auth.uid() or cooperativa_id in (select public.minhas_cooperativas())
    )
  );

-- o script de ingestão da Conab roda com a service_role key, que sempre
-- ignora RLS — nenhuma policy extra é necessária pra ele ler/atualizar aqui.
