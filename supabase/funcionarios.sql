-- Lista leve de funcionários do produtor (nome + WhatsApp, sem login) —
-- só pra poder endereçar um lembrete a uma pessoa específica da equipe de
-- campo, reaproveitando o envio de lembretes que já existe. Não precisa
-- de conta/senha: o funcionário só recebe a mensagem no WhatsApp dele.
create table funcionarios (
  id uuid primary key default gen_random_uuid(),
  produtor_id uuid not null references produtores(id) on delete cascade,
  nome text not null,
  whatsapp text not null check (whatsapp ~ '^[0-9]+$'),
  created_at timestamptz not null default now(),
  unique (produtor_id, whatsapp)
);

alter table funcionarios enable row level security;

create policy "produtor gerencia seus funcionarios"
on funcionarios
for all
using (produtor_id in (select id from produtores where user_id = auth.uid()))
with check (produtor_id in (select id from produtores where user_id = auth.uid()));
