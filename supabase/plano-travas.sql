-- Travas de plano no banco (2026-10-15).
--
-- Até aqui os limites de plano só existiam na tela (alertas.tsx, funcionarios.tsx...) e no bot.
-- Teste com o login real de cada conta mostrou que, chamando a API direto, um Bronze criava
-- alertas sem limite, funcionários (Bronze tem 0), item da lista do Ouro e alerta de leilão
-- (Prata), e conta cancelada ou com trial vencido também. Estes triggers aplicam a mesma regra
-- do painel e do bot, em qualquer caminho de escrita (painel, bot, API).
--
-- Regras (espelham src/lib/planos.shared.ts e o bot):
--   * sem acesso (cancelada, trial vencido, inadimplente depois de 24h): não cria nem reativa nada;
--   * alertas de preço, clima, câmbio e leilão somados: Bronze até 3 ativos, Prata e Ouro sem limite;
--   * alerta de leilão: Prata ou Ouro;
--   * funcionários: Bronze 0, Prata até 3, Ouro sem limite;
--   * lista de acompanhamento (produtor_watchlist): só Ouro.
-- Não mexe em quem não tem assinatura própria (coberto por cooperativa) nem em quem é membro de
-- cooperativa (o painel usa o plano da cooperativa para esse caso).
--
-- Só valem para INSERT e para reativar alerta (ativo false -> true). Editar ou apagar continua livre.
-- Rodar no editor SQL do Supabase. Para desfazer, rode o bloco "DESFAZER" no fim do arquivo.

create or replace function public.trava_de_plano()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tabela text := tg_table_name;
  v_eh_alerta boolean := tg_table_name in ('alertas_preco', 'alertas_clima', 'alertas_cambio', 'alertas_leilao');
  v_user uuid;
  v_ass record;
  v_acesso boolean;
  v_total int;
begin
  -- Só vale ao criar, ou ao reativar um alerta.
  if tg_op = 'UPDATE' then
    if not v_eh_alerta then return new; end if;
    if not (new.ativo and not coalesce(old.ativo, false)) then return new; end if;
  elsif v_eh_alerta then
    -- (aninhado de propósito: funcionarios e watchlist não têm a coluna "ativo")
    if not coalesce(new.ativo, true) then return new; end if;
  end if;

  select user_id into v_user from public.produtores where id = new.produtor_id;

  -- Membro de cooperativa: o painel segue o plano da cooperativa, não o pessoal. Não trava aqui.
  if v_user is not null and exists (select 1 from public.cooperativa_membros where user_id = v_user) then
    return new;
  end if;

  select plano, status, trial_expira_em, updated_at
    into v_ass
    from public.assinaturas
   where produtor_id = new.produtor_id
   limit 1;

  -- Sem assinatura própria (ex: coberto por cooperativa): sem trava por produtor.
  if not found then return new; end if;

  v_acesso :=
    v_ass.status = 'ativa'
    or (v_ass.status = 'trial' and v_ass.trial_expira_em > now())
    or (v_ass.status = 'inadimplente' and now() - v_ass.updated_at < interval '24 hours');
  if not v_acesso then
    raise exception 'PLANO_SEM_ACESSO' using errcode = 'P0001',
      hint = 'Assinatura cancelada, trial vencido ou pagamento em atraso.';
  end if;

  if v_tabela = 'alertas_leilao' and v_ass.plano not in ('prata', 'ouro') then
    raise exception 'PLANO_EXCLUSIVO_PRATA' using errcode = 'P0001',
      hint = 'Alerta de leilão é do plano Prata.';
  end if;

  if v_eh_alerta and v_ass.plano = 'bronze' then
    select
      (select count(*) from public.alertas_preco  where produtor_id = new.produtor_id and ativo and id <> new.id)
    + (select count(*) from public.alertas_clima  where produtor_id = new.produtor_id and ativo and id <> new.id)
    + (select count(*) from public.alertas_cambio where produtor_id = new.produtor_id and ativo and id <> new.id)
    + (select count(*) from public.alertas_leilao where produtor_id = new.produtor_id and ativo and id <> new.id)
      into v_total;
    if v_total >= 3 then
      raise exception 'PLANO_LIMITE_ALERTAS' using errcode = 'P0001',
        hint = 'O plano Bronze permite até 3 alertas ativos.';
    end if;
  end if;

  if v_tabela = 'funcionarios' then
    select count(*) into v_total from public.funcionarios where produtor_id = new.produtor_id and id <> new.id;
    if v_total >= case v_ass.plano when 'ouro' then 2147483647 when 'prata' then 3 else 0 end then
      raise exception 'PLANO_LIMITE_FUNCIONARIOS' using errcode = 'P0001',
        hint = 'Bronze não tem funcionários, Prata até 3, Ouro sem limite.';
    end if;
  end if;

  if v_tabela = 'produtor_watchlist' and v_ass.plano <> 'ouro' then
    raise exception 'PLANO_EXCLUSIVO_OURO' using errcode = 'P0001',
      hint = 'A lista de acompanhamento é do plano Ouro.';
  end if;

  return new;
end;
$$;

drop trigger if exists trava_plano_alertas_preco on public.alertas_preco;
create trigger trava_plano_alertas_preco before insert or update of ativo on public.alertas_preco
  for each row execute function public.trava_de_plano();

drop trigger if exists trava_plano_alertas_clima on public.alertas_clima;
create trigger trava_plano_alertas_clima before insert or update of ativo on public.alertas_clima
  for each row execute function public.trava_de_plano();

drop trigger if exists trava_plano_alertas_cambio on public.alertas_cambio;
create trigger trava_plano_alertas_cambio before insert or update of ativo on public.alertas_cambio
  for each row execute function public.trava_de_plano();

drop trigger if exists trava_plano_alertas_leilao on public.alertas_leilao;
create trigger trava_plano_alertas_leilao before insert or update of ativo on public.alertas_leilao
  for each row execute function public.trava_de_plano();

drop trigger if exists trava_plano_funcionarios on public.funcionarios;
create trigger trava_plano_funcionarios before insert on public.funcionarios
  for each row execute function public.trava_de_plano();

drop trigger if exists trava_plano_watchlist on public.produtor_watchlist;
create trigger trava_plano_watchlist before insert on public.produtor_watchlist
  for each row execute function public.trava_de_plano();

-- DESFAZER (rodar só se precisar voltar atrás):
-- drop trigger if exists trava_plano_alertas_preco on public.alertas_preco;
-- drop trigger if exists trava_plano_alertas_clima on public.alertas_clima;
-- drop trigger if exists trava_plano_alertas_cambio on public.alertas_cambio;
-- drop trigger if exists trava_plano_alertas_leilao on public.alertas_leilao;
-- drop trigger if exists trava_plano_funcionarios on public.funcionarios;
-- drop trigger if exists trava_plano_watchlist on public.produtor_watchlist;
-- drop function if exists public.trava_de_plano();
