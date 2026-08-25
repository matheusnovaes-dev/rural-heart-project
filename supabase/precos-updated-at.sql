-- A tabela `precos` já existe no banco (criada fora deste repo, pelo
-- ingest da Conab) — por isso aqui é só ALTER, não CREATE. Adiciona
-- updated_at e um trigger que carimba sozinho em todo insert/update,
-- pra qualquer script de ingestão (não só o atual) manter isso correto
-- sem precisar lembrar de setar o campo manualmente.
alter table public.precos
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_precos_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists precos_set_updated_at on public.precos;
create trigger precos_set_updated_at
  before insert or update on public.precos
  for each row execute function public.set_precos_updated_at();
