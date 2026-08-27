-- Leads da landing page (safralume.com.br) são internos da Safralume, não
-- de uma cooperativa parceira qualquer. A política antiga liberava
-- ver/editar/apagar pra QUALQUER membro de QUALQUER cooperativa
-- (auth.uid() IN cooperativa_membros inteira, sem filtro de cooperativa_id
-- nenhum) — vazamento real confirmado em 2026-08-27: dois admins de outras
-- cooperativas (wearebrazilians.bz@gmail.com, cristinamoura570@gmail.com)
-- já tinham esse acesso a leads que não eram deles.
--
-- Restringe as 3 políticas de leitura/edição/exclusão só à cooperativa do
-- Matheus (c8bd4009-e324-43f1-970d-1ca48e4e85f6, "Cooperativo teste").
-- INSERT continua público (o formulário da landing page não é autenticado).

drop policy if exists "cooperativa ve leads" on public.leads;
drop policy if exists "cooperativa atualiza leads" on public.leads;
drop policy if exists "cooperativa apaga leads" on public.leads;

create policy "safralume admin ve leads" on public.leads
  for select
  using (auth.uid() in (
    select user_id from public.cooperativa_membros
    where cooperativa_id = 'c8bd4009-e324-43f1-970d-1ca48e4e85f6'
  ));

create policy "safralume admin atualiza leads" on public.leads
  for update
  using (auth.uid() in (
    select user_id from public.cooperativa_membros
    where cooperativa_id = 'c8bd4009-e324-43f1-970d-1ca48e4e85f6'
  ));

create policy "safralume admin apaga leads" on public.leads
  for delete
  using (auth.uid() in (
    select user_id from public.cooperativa_membros
    where cooperativa_id = 'c8bd4009-e324-43f1-970d-1ca48e4e85f6'
  ));
