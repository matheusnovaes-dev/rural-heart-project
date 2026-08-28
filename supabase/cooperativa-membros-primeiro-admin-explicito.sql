-- A policy antiga só checava "user_id = auth.uid()" pra inserir em
-- cooperativa_membros, sem checar cooperativa_id nenhuma — no texto da
-- regra, qualquer usuário logado poderia se inserir como admin de
-- QUALQUER cooperativa já existente (não só a que acabou de criar).
-- Testes reais via REST mostraram isso bloqueado na prática, mas por um
-- motivo não explícito na própria regra — perigoso depender disso.
-- Reescreve pra a policy garantir sozinha "só o primeiro admin".
--
-- A primeira versão dessa correção usava um "not exists" direto na mesma
-- tabela, o que causou recursão infinita (RLS reavaliando a própria
-- policy dentro da subquery). Corrigido movendo a checagem pra uma
-- função SECURITY DEFINER, mesmo padrão de sou_admin_de/minhas_cooperativas.
create or replace function public.cooperativa_sem_membros(coop_id uuid)
returns boolean
language sql
stable
security definer
as $$
  select not exists (
    select 1 from public.cooperativa_membros
    where cooperativa_id = coop_id
  );
$$;

drop policy "usuario se adiciona como primeiro admin" on cooperativa_membros;

create policy "usuario se adiciona como primeiro admin"
on cooperativa_membros
for insert
with check (
  user_id = auth.uid()
  and papel = 'admin'
  and cooperativa_sem_membros(cooperativa_id)
);
