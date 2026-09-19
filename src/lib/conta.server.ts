import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseServiceRole } from "@/lib/supabase.server";

const DOMINIO_CONTA_TECNICA = "@safralume.app";

const definirAcessoSchema = z.object({
  accessToken: z.string().min(1),
  email: z.string().trim().toLowerCase().email("Digite um e-mail válido."),
  senha: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres.").max(72),
});

/**
 * Quem se cadastra pelo formulário da landing entra com uma conta técnica
 * (lead-<whatsapp>@safralume.app, senha aleatória que ninguém vê) — só
 * funciona no navegador onde ele se cadastrou, e o "esqueci minha senha"
 * mandaria e-mail pra um endereço que não existe. Esta função troca a conta
 * técnica por e-mail e senha de verdade, pra ele conseguir voltar de
 * qualquer aparelho.
 *
 * Roda com service role (troca de e-mail direto, sem link de confirmação):
 * a confirmação padrão do Supabase exigiria clicar num link enviado ao
 * endereço técnico antigo, que nunca chega. Mesma postura do cadastro atual,
 * que também não verifica e-mail. Só aceita contas técnicas — uma conta que
 * já tem e-mail de verdade não pode ser alterada por aqui.
 */
export const definirAcessoConta = createServerFn({ method: "POST" })
  .validator(definirAcessoSchema)
  .handler(async ({ data }) => {
    const supabase = supabaseServiceRole();

    const { data: auth, error: authError } = await supabase.auth.getUser(data.accessToken);
    const user = auth?.user;
    if (authError || !user) {
      throw new Error("Sessão expirada. Entre de novo e tente outra vez.");
    }
    if (!user.email?.toLowerCase().endsWith(DOMINIO_CONTA_TECNICA)) {
      throw new Error("Sua conta já tem um e-mail cadastrado.");
    }
    if (data.email.endsWith(DOMINIO_CONTA_TECNICA)) {
      throw new Error("Use o seu e-mail de verdade.");
    }

    // O Supabase devolve um 500 genérico ("Error updating user") quando o
    // e-mail já é de outra conta, sem nenhum código que dê pra reconhecer —
    // então confere antes, por uma função só do service role.
    const { data: emUso } = await supabase.rpc("email_ja_cadastrado", { p_email: data.email });
    if (emUso === true) {
      throw new Error("Esse e-mail já tem uma conta. Entre nela em /login ou use outro e-mail.");
    }

    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      email: data.email,
      password: data.senha,
      email_confirm: true,
    });
    if (error) {
      if (/already|registered|exists/i.test(error.message)) {
        throw new Error("Esse e-mail já tem uma conta. Entre nela em /login ou use outro e-mail.");
      }
      if (error.code === "weak_password" || /password/i.test(error.message)) {
        throw new Error("Senha muito fraca. Use pelo menos 8 caracteres com letras e números.");
      }
      throw new Error("Não foi possível salvar agora. Tente de novo.");
    }

    return { email: data.email };
  });
