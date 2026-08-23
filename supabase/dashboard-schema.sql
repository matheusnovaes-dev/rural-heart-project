-- Cooperativas (tenant raiz)
create table public.cooperativas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  logo_url text,
  cor_primaria text,
  created_at timestamptz not null default now()
);

-- Vínculo usuário-cooperativa (permite múltiplos membros de equipe)
create table public.cooperativa_membros (
  cooperativa_id uuid not null references public.cooperativas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  papel text not null default 'membro' check (papel in ('admin', 'membro')),
  created_at timestamptz not null default now(),
  primary key (cooperativa_id, user_id)
);

-- Produtores (podem ou não estar ligados a uma cooperativa)
create table public.produtores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  cooperativa_id uuid references public.cooperativas(id) on delete set null,
  nome text not null,
  whatsapp text not null,
  cultura_principal text,
  uf text,
  created_at timestamptz not null default now()
);

-- Lembretes (produtor ou cooperativa criando pra funcionário/produtor)
create table public.lembretes (
  id uuid primary key default gen_random_uuid(),
  produtor_id uuid not null references public.produtores(id) on delete cascade,
  criado_por uuid not null references auth.users(id),
  titulo text not null,
  descricao text,
  enviar_em timestamptz not null,
  whatsapp_destino text not null,
  status text not null default 'pendente' check (status in ('pendente', 'enviado', 'erro', 'cancelado')),
  recorrencia text check (recorrencia in ('diaria', 'semanal')),
  created_at timestamptz not null default now()
);

alter table public.cooperativas enable row level security;
alter table public.cooperativa_membros enable row level security;
alter table public.produtores enable row level security;
alter table public.lembretes enable row level security;

-- Helper: cooperativas do usuário logado
create or replace function public.minhas_cooperativas()
returns setof uuid
language sql
security definer
stable
as $$
  select cooperativa_id from public.cooperativa_membros where user_id = auth.uid();
$$;

-- cooperativas: membros veem/editam a própria
create policy "membros veem sua cooperativa" on public.cooperativas
  for select using (id in (select public.minhas_cooperativas()));

create policy "admins editam sua cooperativa" on public.cooperativas
  for update using (
    id in (
      select cooperativa_id from public.cooperativa_membros
      where user_id = auth.uid() and papel = 'admin'
    )
  );

-- qualquer usuário autenticado pode criar uma cooperativa (fluxo de onboarding)
create policy "usuario autenticado cria cooperativa" on public.cooperativas
  for insert with check (auth.uid() is not null);

-- cooperativa_membros
create policy "membros veem colegas da mesma cooperativa" on public.cooperativa_membros
  for select using (cooperativa_id in (select public.minhas_cooperativas()));

create policy "usuario se adiciona como primeiro admin" on public.cooperativa_membros
  for insert with check (user_id = auth.uid());

create policy "admin adiciona/remove membros" on public.cooperativa_membros
  for all using (
    cooperativa_id in (
      select cooperativa_id from public.cooperativa_membros
      where user_id = auth.uid() and papel = 'admin'
    )
  );

-- produtores: vê a própria linha, ou membro vê os produtores da cooperativa
create policy "produtor ve a propria linha" on public.produtores
  for select using (user_id = auth.uid());

create policy "produtor edita a propria linha" on public.produtores
  for update using (user_id = auth.uid());

create policy "cooperativa ve seus produtores" on public.produtores
  for select using (cooperativa_id in (select public.minhas_cooperativas()));

create policy "cooperativa gerencia seus produtores" on public.produtores
  for all using (cooperativa_id in (select public.minhas_cooperativas()));

create policy "usuario autenticado cria seu proprio produtor" on public.produtores
  for insert with check (user_id = auth.uid());

-- lembretes: herda visibilidade via produtor_id
create policy "ve lembretes dos produtores visiveis" on public.lembretes
  for select using (
    produtor_id in (
      select id from public.produtores
      where user_id = auth.uid() or cooperativa_id in (select public.minhas_cooperativas())
    )
  );

create policy "cria/edita lembretes dos produtores visiveis" on public.lembretes
  for all using (
    produtor_id in (
      select id from public.produtores
      where user_id = auth.uid() or cooperativa_id in (select public.minhas_cooperativas())
    )
  );

-- leads: liberar select pra qualquer membro de cooperativa (só existe 1 cooperativa real por ora)
create policy "cooperativa ve leads" on public.leads
  for select using (auth.uid() in (select user_id from public.cooperativa_membros));

-- storage bucket para logos
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

create policy "logos sao publicos para leitura" on storage.objects
  for select using (bucket_id = 'logos');

create policy "membros de cooperativa fazem upload de logo" on storage.objects
  for insert with check (
    bucket_id = 'logos' and auth.uid() in (select user_id from public.cooperativa_membros)
  );
