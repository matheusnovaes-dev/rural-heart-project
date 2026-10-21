-- Caderno da fazenda, parte 3 (2026-10-21): estoque, meta de margem com aviso de venda e funcionário
-- lançando pelo WhatsApp. Tudo isso é do plano Prata (e Ouro): o banco também trava, para que ninguém contorne
-- a regra chamando a API direto (mesmo cuidado de plano-travas.sql).
--
-- É seguro: acrescenta colunas e uma trava, e troca duas regras de valores permitidos por versões maiores
-- (acrescentam 'estoque' em tipo e 'funcionario' em origem). Nenhum lançamento existente muda.
--
--   * tipo 'estoque': contagem de sacas guardadas ("tenho 5.000 sacas de soja no armazém").
--   * origem 'funcionario' + lancado_por: gasto, plantio ou colheita anotado por um funcionário no WhatsApp.
--   * fazenda_areas.margem_alvo_pct e controle do aviso de venda por cultura.
--
-- Rodar no editor SQL do Supabase. Para desfazer, rode o bloco "DESFAZER" no fim do arquivo.

do $$
declare c record;
begin
  for c in
    select conname
      from pg_constraint
     where conrelid = 'public.fazenda_registros'::regclass
       and contype = 'c'
       and (pg_get_constraintdef(oid) like '%tipo = ANY%' or pg_get_constraintdef(oid) like '%origem = ANY%')
  loop
    execute format('alter table public.fazenda_registros drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.fazenda_registros
  add constraint fazenda_registros_tipo_check
    check (tipo in ('gasto', 'venda', 'plantio', 'colheita', 'nota', 'estoque')),
  add constraint fazenda_registros_origem_check
    check (origem in ('whatsapp', 'painel', 'funcionario'));

alter table public.fazenda_registros
  add column if not exists lancado_por text check (lancado_por is null or char_length(lancado_por) <= 60);

alter table public.fazenda_areas
  add column if not exists margem_alvo_pct numeric(5, 2)
    check (margem_alvo_pct is null or (margem_alvo_pct > 0 and margem_alvo_pct < 95)),
  add column if not exists aviso_venda_ativo boolean not null default true,
  add column if not exists ultimo_aviso_em timestamptz,
  add column if not exists ultimo_aviso_preco numeric(12, 2);

-- Trava de plano: estoque, funcionário lançando e meta de margem são do Prata e do Ouro.
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
      hint = 'Estoque, meta de margem e lançamento por funcionário são do plano Prata.';
  end if;
  return new;
end;
$$;

drop trigger if exists trava_caderno_prata_registros on public.fazenda_registros;
create trigger trava_caderno_prata_registros
  before insert on public.fazenda_registros
  for each row execute function public.trava_caderno_prata();

drop trigger if exists trava_caderno_prata_areas on public.fazenda_areas;
create trigger trava_caderno_prata_areas
  before insert or update of margem_alvo_pct on public.fazenda_areas
  for each row execute function public.trava_caderno_prata();

-- DESFAZER (remove a parte 3; lançamentos de estoque e de funcionário precisam ser apagados antes):
-- drop trigger if exists trava_caderno_prata_registros on public.fazenda_registros;
-- drop trigger if exists trava_caderno_prata_areas on public.fazenda_areas;
-- drop function if exists public.trava_caderno_prata();
-- alter table public.fazenda_areas drop column if exists margem_alvo_pct, drop column if exists aviso_venda_ativo,
--   drop column if exists ultimo_aviso_em, drop column if exists ultimo_aviso_preco;
-- alter table public.fazenda_registros drop column if exists lancado_por;
-- alter table public.fazenda_registros drop constraint fazenda_registros_tipo_check,
--   add constraint fazenda_registros_tipo_check check (tipo in ('gasto','venda','plantio','colheita','nota'));
-- alter table public.fazenda_registros drop constraint fazenda_registros_origem_check,
--   add constraint fazenda_registros_origem_check check (origem in ('whatsapp','painel'));
