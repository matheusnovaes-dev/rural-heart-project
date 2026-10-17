-- Foto de perfil do produtor ("Meu perfil" no painel).
-- Rodar no editor SQL do Supabase. Pode rodar mais de uma vez (idempotente) e não mexe em nenhum dado existente.

-- 1) Coluna que guarda o endereço da foto (vazia = sem foto).
alter table public.produtores
  add column if not exists foto_url text;

-- 2) Bucket "avatares": leitura pública (a foto aparece no painel), até 2 MB, só imagem comum.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatares', 'avatares', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 3) Quem envia, troca ou apaga só mexe na PRÓPRIA pasta: o caminho é "{id-do-usuário}/avatar-....ext".
--    (Mesmo cuidado da correção das logos: sem isso, qualquer usuário logado sobrescreveria a foto de outro.)
drop policy if exists "produtor envia a propria foto" on storage.objects;
create policy "produtor envia a propria foto" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "produtor troca a propria foto" on storage.objects;
create policy "produtor troca a propria foto" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "produtor apaga a propria foto" on storage.objects;
create policy "produtor apaga a propria foto" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);

-- 4) Ler a própria pasta. Sem isto o produtor não "enxerga" os próprios arquivos e o painel não consegue apagar a foto
--    antiga ao trocar (o envio funciona, mas a antiga ficaria no bucket). A imagem continua pública para exibição.
drop policy if exists "produtor ve a propria foto" on storage.objects;
create policy "produtor ve a propria foto" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);
