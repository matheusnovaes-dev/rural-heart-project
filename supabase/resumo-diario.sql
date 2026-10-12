-- Resumo diário configurável ("bom dia resumido") — pedido do Matheus
-- 2026-10-12: produtor escolhe o horário e recebe todo dia um resumo real
-- (preço, progresso de safra, ferrugem, sinal de venda, previsão do tempo)
-- — diferente da mensagem proativa (que só manda quando algo mudou de
-- verdade), este é sempre enviado no horário escolhido, se o produtor
-- ligou a opção.
alter table public.produtores
  add column if not exists resumo_diario_ativo boolean not null default false,
  add column if not exists resumo_diario_hora smallint check (resumo_diario_hora between 0 and 23),
  add column if not exists resumo_diario_enviado_em timestamptz;

comment on column public.produtores.resumo_diario_ativo is
  'Produtor optou por receber o resumo diário (preço/safra/clima) todo dia.';
comment on column public.produtores.resumo_diario_hora is
  'Hora do dia (0-23, horário de Brasília) que o produtor escolheu pra receber o resumo.';
comment on column public.produtores.resumo_diario_enviado_em is
  'Último envio do resumo diário — usado só pra não mandar 2x no mesmo dia.';
