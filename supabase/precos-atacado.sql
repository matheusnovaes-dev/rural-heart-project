-- Preços de ATACADO (referência de mercado, não é o que o produtor recebe) — IEA-SP, mercado atacadista da Grande São Paulo
-- (CEAGESP e outros). Fica numa tabela PRÓPRIA, fora de `precos`, de propósito: `precos` alimenta o preço do produtor no bot e
-- no painel, e misturar atacado ali mostraria "preço da cebola" como se fosse o que o produtor recebe.
-- Quem escreve: conab-ingestor/ingest-iea-sp-atacado.mjs (service role). Quem lê: o bot (service role) e, no futuro, o painel.
-- Rodar uma vez no SQL Editor do Supabase.
create table if not exists public.precos_atacado (
  id bigint generated always as identity primary key,
  produto text not null,                      -- ex.: CEBOLA, BATATA, ALHO, FEIJÃO, FRANGO, OVO BRANCO
  descricao text not null default '',         -- ex.: Nacional, Comum Lavada, Frango resfriado
  uf text not null,
  praca text not null default '',             -- ex.: RMSP (atacado)
  preco numeric not null,                     -- preço médio do dia
  preco_min numeric,
  preco_max numeric,
  unidade text,                               -- ex.: sc.20 kg, cx.30 dz, kg
  tendencia text,                             -- "mercado" segundo o IEA: Fraco, Estável, Firme...
  data_referencia date not null,
  fonte text not null,
  updated_at timestamptz not null default now(),
  unique (produto, descricao, uf, praca, data_referencia)
);

create index if not exists precos_atacado_busca on public.precos_atacado (uf, produto, data_referencia desc);

-- reaproveita o carimbo de updated_at que já existe para `precos`
drop trigger if exists precos_atacado_set_updated_at on public.precos_atacado;
create trigger precos_atacado_set_updated_at
  before insert or update on public.precos_atacado
  for each row execute function public.set_precos_updated_at();

alter table public.precos_atacado enable row level security;
drop policy if exists "precos_atacado_leitura" on public.precos_atacado;
create policy "precos_atacado_leitura" on public.precos_atacado
  for select to authenticated using (true);
