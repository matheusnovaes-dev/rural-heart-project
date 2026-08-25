-- Frete real (Sifreca/ESALQ-LOG), cobrindo só rotas selecionadas por
-- cultura (não todo município). Usada pra descontar do preço bruto da
-- Conab e mostrar "preço líquido" só onde existe rota de verdade batendo
-- com a UF do produtor — nunca uma estimativa inventada.
create table public.fretes (
  id uuid primary key default gen_random_uuid(),
  cultura text not null,
  municipio_origem text not null,
  uf_origem text not null,
  municipio_destino text not null,
  uf_destino text not null,
  frete_rt numeric not null,
  frete_rt_km numeric,
  periodo text,
  fonte text not null default 'Sifreca/ESALQ-LOG',
  updated_at timestamptz not null default now(),
  unique (cultura, uf_origem, municipio_origem, municipio_destino)
);

alter table public.fretes enable row level security;

create policy "leitura de fretes" on public.fretes
  for select to authenticated using (true);
