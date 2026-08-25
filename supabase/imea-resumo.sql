-- Manchete + resumo do "Destaque" de cada edição, extraídos do próprio PDF
-- (posição/tamanho de fonte, não é resumo gerado por IA) — pra mostrar o
-- Boletim Semanal como conteúdo de verdade no dashboard, não só um link.
alter table public.imea_boletins
  add column if not exists manchete text,
  add column if not exists resumo text;
