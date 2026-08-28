-- Impede dois produtores com o mesmo número de WhatsApp: o bot busca por
-- telefone e não tem como decidir entre dois cadastros iguais.
alter table produtores
  add constraint produtores_whatsapp_unique unique (whatsapp);

-- Reforça que o campo só guarda dígitos (sem parênteses/traço/espaço),
-- que é o formato que o bot do WhatsApp usa pra comparar telefone.
alter table produtores
  add constraint produtores_whatsapp_apenas_digitos check (whatsapp ~ '^[0-9]+$');
