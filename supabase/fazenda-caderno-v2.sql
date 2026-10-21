-- Caderno da fazenda, parte 2 (2026-10-21): a pagar e a receber, rascunho de nota lida por foto,
-- área e produtividade por cultura (custo por saca e margem).
--
-- É seguro: só ACRESCENTA colunas (com valor padrão que mantém os lançamentos que já existem como estão)
-- e uma tabela nova com a mesma regra de privacidade do caderno (cada produtor só enxerga o que é dele).
--
--   * situacao: 'realizado' (padrão, o que já existia), 'pendente' (a pagar ou a receber, com vencimento) e
--     'rascunho' (nota lida da foto, esperando o produtor responder "sim"; não entra em nenhuma conta).
--   * lembrete_id: o lembrete do dia do vencimento (o n8n já envia os lembretes pelo WhatsApp).
--   * lembretes.criado_por passa a aceitar vazio: o lembrete criado pelo bot não tem usuário do painel
--     (cliente que só usa o WhatsApp). Nada muda para os lembretes feitos no painel.
--
-- Rodar no editor SQL do Supabase. Para desfazer, rode o bloco "DESFAZER" no fim do arquivo.

alter table public.fazenda_registros
  add column if not exists situacao text not null default 'realizado'
    check (situacao in ('realizado', 'pendente', 'rascunho')),
  add column if not exists vence_em date,
  add column if not exists lembrete_id uuid references public.lembretes(id) on delete set null,
  add column if not exists realizado_em date;

create index if not exists fazenda_registros_pendencias_idx
  on public.fazenda_registros (produtor_id, vence_em)
  where apagado_em is null and situacao = 'pendente';

create index if not exists fazenda_registros_rascunho_idx
  on public.fazenda_registros (produtor_id, criado_em desc)
  where apagado_em is null and situacao = 'rascunho';

alter table public.lembretes alter column criado_por drop not null;

create table if not exists public.fazenda_areas (
  id uuid primary key default gen_random_uuid(),
  produtor_id uuid not null references public.produtores(id) on delete cascade,
  cultura text not null check (char_length(cultura) between 1 and 40),
  area_ha numeric(12, 2) not null check (area_ha > 0 and area_ha < 10000000),
  -- sacas por hectare (a que o produtor espera ou colheu). Vazio = usar a média da Conab do estado.
  produtividade_sc_ha numeric(8, 2) check (produtividade_sc_ha is null or (produtividade_sc_ha > 0 and produtividade_sc_ha < 1000)),
  atualizado_em timestamptz not null default now(),
  unique (produtor_id, cultura)
);

alter table public.fazenda_areas enable row level security;

drop policy if exists "produtor gerencia as areas da fazenda" on public.fazenda_areas;
create policy "produtor gerencia as areas da fazenda"
on public.fazenda_areas
for all
using (produtor_id in (select id from public.produtores where user_id = auth.uid()))
with check (produtor_id in (select id from public.produtores where user_id = auth.uid()));

-- DESFAZER (só se quiser remover esta parte; as colunas novas e a tabela de áreas somem com os dados):
-- drop table if exists public.fazenda_areas;
-- drop index if exists public.fazenda_registros_pendencias_idx;
-- drop index if exists public.fazenda_registros_rascunho_idx;
-- alter table public.fazenda_registros drop column if exists situacao, drop column if exists vence_em,
--   drop column if exists lembrete_id, drop column if exists realizado_em;
-- (lembretes.criado_por: voltar a exigir só é possível se nenhum lembrete tiver criado_por vazio.)
