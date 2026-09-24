-- Busca de janela ZARC tolerante a acento.
--
-- O município do produtor vem de geocodificação de terceiros e às vezes
-- chega sem acento (ex: "Pompeu"), enquanto a Tábua de Risco do ZARC usa o
-- nome oficial do IBGE (ex: "Pompéu"). ILIKE puro não ignora acento, então
-- dado que existia de verdade aparecia como "não encontrado" no painel e no
-- bot (achado testando o card "Janela de plantio" com o próprio cadastro,
-- 2026-09-24).
create extension if not exists unaccent with schema extensions;

create or replace function public.buscar_zarc_janela(p_cultura text, p_uf text, p_municipio text)
returns table (riscos_decendio integer[])
language sql
stable
set search_path = public, extensions
as $$
  select z.riscos_decendio
  from zarc_janelas_plantio z
  where z.cultura = p_cultura
    and z.uf = p_uf
    and extensions.unaccent(z.municipio) ilike extensions.unaccent('%' || p_municipio || '%')
  limit 100;
$$;

grant execute on function public.buscar_zarc_janela(text, text, text) to anon, authenticated;
