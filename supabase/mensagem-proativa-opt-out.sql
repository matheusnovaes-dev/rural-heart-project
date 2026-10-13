-- Opt-out da mensagem proativa diária (preço/clima/câmbio) — pedido do
-- Matheus 2026-10-13: template é categoria MARKETING na Meta, produtor
-- precisa ter como pedir pra parar de receber. Default true (quem já é
-- engajado continua recebendo, igual o comportamento atual) — produtor
-- desativa pedindo pro bot, não tem toggle no painel (ver
-- configurar_resumo_diario como o mesmo padrão já usado em
-- src/lib/bot/tools/resumoDiario.ts).
alter table public.produtores
  add column if not exists mensagem_proativa_ativa boolean not null default true;

comment on column public.produtores.mensagem_proativa_ativa is
  'Produtor optou por continuar recebendo (true, padrão) ou parar de receber (false) a mensagem proativa diária de preço/clima/câmbio. Controlado só pelo bot (ferramenta configurar_mensagem_proativa), sem toggle no painel.';
