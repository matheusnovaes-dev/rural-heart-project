-- Alerta de clima por cidade (2026-10-16).
--
-- Até aqui o alerta de clima só guardava a UF e o verificador diário olhava a previsão da CAPITAL do
-- estado. Produtor que pede "avisa se chover em Fátima do Sul" recebia aviso de Campo Grande (~200 km).
-- Agora o alerta pode ser por cidade (opcional): guarda o nome e as coordenadas, e o verificador usa
-- essas coordenadas. Alertas já existentes ficam com as três colunas nulas e continuam por estado,
-- exatamente como antes. Seguro de rodar mais de uma vez.

alter table public.alertas_clima
  add column if not exists cidade text,
  add column if not exists lat double precision,
  add column if not exists lon double precision;

-- DESFAZER (só se precisar): alter table public.alertas_clima drop column cidade, drop column lat, drop column lon;
