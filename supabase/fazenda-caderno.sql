-- Caderno da fazenda (2026-10-21).
--
-- Registro simples do que acontece na fazenda: gasto, venda, plantio, colheita e anotação livre.
-- O produtor lança pelo WhatsApp ("gastei 12 mil de adubo no talhão 3", "vendi 500 sacas a 135") ou
-- pelo painel, e o bot e o painel leem a mesma tabela.
--
-- Privacidade: é dado financeiro do produtor. Só ele enxerga as próprias linhas (RLS por produtor,
-- igual a `funcionarios`). O bot grava com a chave de serviço, sempre para o produtor do telefone
-- que escreveu. Apagar no painel ou no bot é "apagado_em" (some das telas e dos resumos).
--
-- Rodar no editor SQL do Supabase. Para desfazer, rode o bloco "DESFAZER" no fim do arquivo.

create table if not exists public.fazenda_registros (
  id uuid primary key default gen_random_uuid(),
  produtor_id uuid not null references public.produtores(id) on delete cascade,
  tipo text not null check (tipo in ('gasto', 'venda', 'plantio', 'colheita', 'nota')),
  -- Dia em que aconteceu (pode ser retroativo). Padrão: hoje no horário de Brasília.
  ocorrido_em date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  -- Valor total em reais (gasto ou venda). Vazio em plantio, colheita e nota.
  valor numeric(14, 2) check (valor is null or (valor >= 0 and valor < 1000000000)),
  descricao text not null check (char_length(descricao) between 1 and 300),
  categoria text check (categoria is null or char_length(categoria) <= 40),
  cultura text check (cultura is null or char_length(cultura) <= 40),
  talhao text check (talhao is null or char_length(talhao) <= 60),
  quantidade numeric(14, 3) check (quantidade is null or (quantidade >= 0 and quantidade < 1000000000)),
  unidade text check (unidade is null or char_length(unidade) <= 20),
  preco_unitario numeric(14, 2) check (preco_unitario is null or (preco_unitario >= 0 and preco_unitario < 1000000)),
  origem text not null default 'painel' check (origem in ('whatsapp', 'painel')),
  criado_em timestamptz not null default now(),
  apagado_em timestamptz
);

create index if not exists fazenda_registros_produtor_data_idx
  on public.fazenda_registros (produtor_id, ocorrido_em desc, criado_em desc)
  where apagado_em is null;

alter table public.fazenda_registros enable row level security;

drop policy if exists "produtor gerencia o caderno da fazenda" on public.fazenda_registros;
create policy "produtor gerencia o caderno da fazenda"
on public.fazenda_registros
for all
using (produtor_id in (select id from public.produtores where user_id = auth.uid()))
with check (produtor_id in (select id from public.produtores where user_id = auth.uid()));

-- DESFAZER (rode só se quiser remover o caderno e tudo que foi lançado nele):
-- drop table if exists public.fazenda_registros;
