-- Fix único, não repetível: o trigger de reagendar_lembrete_recorrente só
-- age em atualizações futuras — não conserta sozinho um lembrete recorrente
-- que já ficou parado em status='enviado' antes de o trigger existir.
-- Isso aqui destrava esses casos de uma vez: volta pra 'pendente' com
-- enviar_em rolado pro mesmo horário de hoje (ou, se esse horário de hoje
-- já passou, o n8n pega no próximo ciclo de 15 min e manda agora mesmo —
-- é o comportamento certo pra um lembrete que devia ter disparado e não
-- disparou).
update public.lembretes
set
  status = 'pendente',
  enviar_em = date_trunc('day', now()) + (enviar_em::time)
where status = 'enviado'
  and recorrencia is not null;
