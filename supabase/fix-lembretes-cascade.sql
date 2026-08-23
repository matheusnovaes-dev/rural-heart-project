alter table public.lembretes drop constraint lembretes_criado_por_fkey;
alter table public.lembretes
  add constraint lembretes_criado_por_fkey
  foreign key (criado_por) references auth.users(id) on delete cascade;
