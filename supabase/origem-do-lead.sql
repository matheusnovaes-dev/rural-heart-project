-- Origem do lead/cadastro (UTM, anúncio, Instagram, direto). Rodar no SQL Editor
-- do Supabase. É seguro rodar antes OU depois de publicar o código: o site grava
-- sem origem enquanto as colunas não existirem.

alter table public.leads
  add column if not exists origem text,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text;

alter table public.cadastro_iniciados
  add column if not exists origem text,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text;

alter table public.produtores
  add column if not exists origem text,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text;

-- Consultas úteis depois de alguns dias:
--   Leads por origem (7 dias):
--     select coalesce(origem, 'sem origem') as origem, count(*)
--     from cadastro_iniciados where created_at > now() - interval '7 days'
--     group by 1 order by 2 desc;
--   Cadastros completos por origem:
--     select coalesce(origem, 'sem origem') as origem, count(*)
--     from produtores where created_at > now() - interval '7 days'
--     group by 1 order by 2 desc;
