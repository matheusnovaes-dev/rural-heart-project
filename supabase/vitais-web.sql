-- Métricas de desempenho de visitantes REAIS (LCP, CLS, INP, FCP, TTFB), anônimas. Rodar no SQL Editor do Supabase.
-- É seguro rodar antes OU depois de publicar o código: o site tenta gravar e ignora o erro enquanto a tabela não existir.
--
-- Anônimo de propósito: sem IP, sem telefone, sem id de usuário, sem cookie. Guarda só a página (sem parâmetros de URL),
-- a métrica e o "perfil" do aparelho (celular/desktop, memória, núcleos, rede, navegador grosso, app do Instagram/Facebook).
-- O anon só consegue INSERIR (nunca ler); quem lê é o service role (script campanhas/vitais_resumo.py).

create table if not exists public.vitais_web (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  pagina text not null check (char_length(pagina) <= 60),
  metrica text not null check (metrica in ('LCP', 'CLS', 'INP', 'FCP', 'TTFB')),
  valor numeric not null check (valor >= 0 and valor < 600000),
  aparelho text check (aparelho in ('celular', 'tablet', 'desktop')),
  memoria_gb numeric check (memoria_gb is null or (memoria_gb >= 0 and memoria_gb <= 64)),
  nucleos int check (nucleos is null or (nucleos >= 0 and nucleos <= 128)),
  rede text check (rede is null or char_length(rede) <= 12),
  navegador text check (navegador is null or char_length(navegador) <= 24),
  app text check (app is null or char_length(app) <= 16),
  nivel_fx text check (nivel_fx is null or nivel_fx in ('alta', 'media', 'baixa')),
  largura int check (largura is null or (largura >= 0 and largura <= 10000)),
  versao text check (versao is null or char_length(versao) <= 40)
);

alter table public.vitais_web enable row level security;

drop policy if exists "vitais_web_insert_anonimo" on public.vitais_web;
create policy "vitais_web_insert_anonimo"
  on public.vitais_web
  for insert
  to anon, authenticated
  with check (true);

-- Sem policy de select/update/delete: ninguém além do service role lê ou altera.

create index if not exists vitais_web_created_at_idx on public.vitais_web (created_at desc);
create index if not exists vitais_web_metrica_idx on public.vitais_web (metrica, created_at desc);

-- Limpeza: guarda 90 dias (rodar de vez em quando, ou agendar):
--   delete from public.vitais_web where created_at < now() - interval '90 days';
