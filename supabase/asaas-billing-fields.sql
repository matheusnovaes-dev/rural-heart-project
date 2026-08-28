-- Migração do Stripe pra Asaas: CPF/CNPJ é obrigatório pra criar cliente na
-- Asaas, e precisamos guardar os IDs do cliente/assinatura de lá.
alter table produtores add column if not exists cpf_cnpj text;
alter table cooperativas add column if not exists cpf_cnpj text;
alter table assinaturas add column if not exists asaas_customer_id text;
alter table assinaturas add column if not exists asaas_subscription_id text;
