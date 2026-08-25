-- Status de contato pra tela de Leads do dashboard, e as policies pra
-- cooperativa poder marcar/apagar (só existia policy de select até aqui).
alter table public.leads
  add column contatado boolean not null default false;

create policy "cooperativa atualiza leads" on public.leads
  for update using (auth.uid() in (select user_id from public.cooperativa_membros));

create policy "cooperativa apaga leads" on public.leads
  for delete using (auth.uid() in (select user_id from public.cooperativa_membros));
