-- O n8n já lê `lembretes` (status = pendente e enviar_em <= agora), manda
-- via WhatsApp e marca status = 'enviado' — isso funciona. O que faltava:
-- nada reagendava um lembrete 'diaria'/'semanal' pro próximo ciclo, então
-- ele disparava uma vez só e nunca mais (era exatamente o bug reportado:
-- lembrete das 8h que não repetiu no dia seguinte).
--
-- Esse trigger detecta a transição pra 'enviado' num lembrete recorrente e
-- devolve a linha pra 'pendente' com enviar_em avançado — assim o próprio
-- n8n (sem nenhuma mudança nele) pega ela de novo no próximo ciclo.
create or replace function public.reagendar_lembrete_recorrente()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'enviado' and new.recorrencia is not null then
    update public.lembretes
    set
      status = 'pendente',
      enviar_em = case new.recorrencia
        when 'diaria' then new.enviar_em + interval '1 day'
        when 'semanal' then new.enviar_em + interval '7 days'
        else new.enviar_em
      end
    where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists lembretes_reagendar_recorrente on public.lembretes;
create trigger lembretes_reagendar_recorrente
  after update on public.lembretes
  for each row execute function public.reagendar_lembrete_recorrente();
