-- Mesmo padrão de vazamento encontrado e corrigido em leads-restringir-
-- cooperativa.sql: a política de upload de logo (bucket público "logos")
-- checava só se o usuário era membro de QUALQUER cooperativa
-- (auth.uid() IN cooperativa_membros inteira), sem validar a pasta de
-- destino. Como o caminho do arquivo é "{cooperativa_id}/logo-....ext" e
-- nada validava isso contra o próprio uid, qualquer admin de cooperativa
-- conseguia sobrescrever a logo de qualquer OUTRA cooperativa (o bucket é
-- público pra leitura, então isso também seria visível a todo mundo).
--
-- Reusa a função sou_admin_de() já existente no projeto (mesma usada nas
-- políticas da tabela cooperativas) pra exigir que a primeira pasta do
-- caminho seja uma cooperativa da qual o usuário é admin.

drop policy if exists "membros de cooperativa fazem upload de logo" on storage.objects;

create policy "admin da cooperativa faz upload da propria logo" on storage.objects
  for insert
  with check (
    bucket_id = 'logos'
    and sou_admin_de(((storage.foldername(name))[1])::uuid)
  );
