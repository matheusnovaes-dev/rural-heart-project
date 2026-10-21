-- Pausa da cobrança no cancelamento (2026-10-21): quem cancela por "não estou usando o suficiente" pode pausar
-- em vez de cancelar. Uma pausa por assinatura. Rodar no SQL Editor do Supabase ANTES de publicar a tela.
alter table public.assinaturas
  add column if not exists pausa_usada_em timestamptz,
  add column if not exists pausada_ate timestamptz;

comment on column public.assinaturas.pausa_usada_em is 'Quando o cliente usou a pausa (no máximo uma por assinatura).';
comment on column public.assinaturas.pausada_ate is 'Até quando a cobrança ficou pausada (vencimento empurrado na Asaas e trial estendido, se for o caso).';
