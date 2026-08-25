-- Guarda nome/e-mail de quem entra na cooperativa, pra Equipe (dashboard)
-- não precisar mostrar o user_id (UUID) cru na lista de membros.
alter table public.cooperativa_membros
  add column nome text,
  add column email text;
