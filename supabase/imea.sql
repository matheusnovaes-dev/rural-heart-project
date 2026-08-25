-- Segunda fonte de preço (IMEA, Mato Grosso), usada pra cross-check contra a
-- Conab e pra listar as edições do Boletim Semanal como conteúdo pro
-- produtor. Só cobre soja/milho/algodão/boi (as únicas cadeias com boletim
-- semanal vivo e com preço de verdade) — nunca fingimos cobertura maior.
create table public.imea_indicadores (
  id uuid primary key default gen_random_uuid(),
  cadeia text not null,
  indicador text not null,
  local text,
  unidade text not null,
  periodicidade text not null,
  valor numeric not null,
  data_referencia date not null,
  fonte text not null default 'Imea',
  updated_at timestamptz not null default now(),
  unique (cadeia, indicador, local, periodicidade, data_referencia)
);

create table public.imea_boletins (
  id uuid primary key default gen_random_uuid(),
  cadeia text not null,
  numero integer,
  titulo text not null,
  data_publicacao date not null,
  url_leitura text not null,
  updated_at timestamptz not null default now(),
  unique (cadeia, data_publicacao)
);

alter table public.imea_indicadores enable row level security;
alter table public.imea_boletins enable row level security;

create policy "leitura de imea_indicadores" on public.imea_indicadores
  for select to authenticated using (true);

create policy "leitura de imea_boletins" on public.imea_boletins
  for select to authenticated using (true);
