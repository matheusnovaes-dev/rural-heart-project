-- Mensagem proativa diária (1x/dia, só pra quem já ativou, com dado real
-- relevante: preço que moveu ou clima severo). Precisa de uma coluna pra
-- controlar "já mandou hoje" e nunca mandar 2x no mesmo dia, mesmo se o
-- cron rodar de novo por engano.
alter table public.produtores
  add column if not exists proativa_enviada_em timestamptz;

comment on column public.produtores.proativa_enviada_em is
  'Último envio da mensagem proativa diária (preço/clima). Usado só pra não mandar 2x no mesmo dia — não é um alerta de verdade, é o /api/cron/mensagem-proativa.';
