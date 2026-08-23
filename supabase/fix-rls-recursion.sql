-- Corrige recursão infinita: a policy de admin não pode subconsultar
-- cooperativa_membros diretamente de dentro de uma policy da própria tabela.
create or replace function public.sou_admin_de(coop_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.cooperativa_membros
    where cooperativa_id = coop_id and user_id = auth.uid() and papel = 'admin'
  );
$$;

drop policy if exists "admin adiciona/remove membros" on public.cooperativa_membros;
create policy "admin adiciona/remove membros" on public.cooperativa_membros
  for all using (public.sou_admin_de(cooperativa_id));

drop policy if exists "admins editam sua cooperativa" on public.cooperativas;
create policy "admins editam sua cooperativa" on public.cooperativas
  for update using (public.sou_admin_de(id));
