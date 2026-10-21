-- Caderno da fazenda, parte 4 (2026-10-21): orçamento por categoria de gasto (plano Prata e Ouro).
-- O produtor diz "orçamento de adubo 100 mil" no WhatsApp (ou define na tela Fazenda do painel) e o caderno acompanha
-- quanto da safra (1/set a 31/ago) já foi gasto em cada categoria, avisando ao passar de 80% e de 100%.
--
-- É seguro: cria uma tabela nova e acrescenta um ramo na trava de plano. Nenhum lançamento existente muda.
-- Rodar no editor SQL do Supabase. Para desfazer, rode o bloco "DESFAZER" no fim do arquivo.

create table if not exists public.fazenda_orcamentos (
  id uuid primary key default gen_random_uuid(),
  produtor_id uuid not null references public.produtores(id) on delete cascade,
  -- uma das categorias de gasto do caderno ("Adubo e corretivos", "Defensivos", ...)
  categoria text not null check (char_length(categoria) between 1 and 60),
  valor numeric(14, 2) not null check (valor > 0 and valor < 100000000000),
  atualizado_em timestamptz not null default now(),
  unique (produtor_id, categoria)
);

alter table public.fazenda_orcamentos enable row level security;

drop policy if exists "produtor gerencia os orcamentos da fazenda" on public.fazenda_orcamentos;
create policy "produtor gerencia os orcamentos da fazenda"
on public.fazenda_orcamentos
for all
using (produtor_id in (select id from public.produtores where user_id = auth.uid()))
with check (produtor_id in (select id from public.produtores where user_id = auth.uid()));

-- Trava de plano: igual à de estoque e meta de margem (supabase/fazenda-caderno-v3.sql), com um ramo a mais para esta tabela.
create or replace function public.trava_caderno_prata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_plano text;
begin
  if tg_table_name = 'fazenda_registros' then
    if new.tipo <> 'estoque' and coalesce(new.origem, '') <> 'funcionario' then return new; end if;
  elsif tg_table_name = 'fazenda_areas' then
    if new.margem_alvo_pct is null then return new; end if;
    if tg_op = 'UPDATE' and new.margem_alvo_pct is not distinct from old.margem_alvo_pct then return new; end if;
  elsif tg_table_name = 'fazenda_orcamentos' then
    if tg_op = 'UPDATE' and new.valor is not distinct from old.valor then return new; end if;
  end if;

  select user_id into v_user from public.produtores where id = new.produtor_id;
  -- Membro de cooperativa: o painel segue o plano da cooperativa. Não trava aqui.
  if v_user is not null and exists (select 1 from public.cooperativa_membros where user_id = v_user) then
    return new;
  end if;

  select plano into v_plano from public.assinaturas where produtor_id = new.produtor_id limit 1;
  -- Sem assinatura própria (ex: coberto por cooperativa): sem trava por produtor.
  if not found then return new; end if;

  if v_plano not in ('prata', 'ouro') then
    raise exception 'PLANO_EXCLUSIVO_PRATA' using errcode = 'P0001',
      hint = 'Estoque, meta de margem, orçamento e lançamento por funcionário são do plano Prata.';
  end if;
  return new;
end;
$$;

drop trigger if exists trava_caderno_prata_orcamentos on public.fazenda_orcamentos;
create trigger trava_caderno_prata_orcamentos
  before insert or update of valor on public.fazenda_orcamentos
  for each row execute function public.trava_caderno_prata();

-- DESFAZER (remove só o orçamento; a trava continua valendo para estoque, meta e funcionário):
-- drop trigger if exists trava_caderno_prata_orcamentos on public.fazenda_orcamentos;
-- drop table if exists public.fazenda_orcamentos;
