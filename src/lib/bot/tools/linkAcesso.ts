import type { SupabaseClient } from "@supabase/supabase-js";

import { SITE_URL } from "@/lib/bot/guardas";

const DOMINIO_CONTA_TECNICA = "@safralume.app";

export type TipoDeAcesso = "sem_login" | "tecnica" | "propria" | "sem_cadastro";

/**
 * Como esse produtor entra (ou não) no painel:
 * - sem_login: cadastrado só pelo WhatsApp, nunca teve conta de login;
 * - tecnica: conta criada pelo formulário da landing (senha que ninguém sabe);
 * - propria: já tem e-mail e senha de verdade.
 */
export async function tipoDeAcesso(
  supabase: SupabaseClient,
  produtorId: string,
): Promise<TipoDeAcesso> {
  const { data: p } = await supabase
    .from("produtores")
    .select("user_id")
    .eq("id", produtorId)
    .maybeSingle();
  if (!p) return "sem_cadastro";
  if (!p.user_id) return "sem_login";
  const { data: u } = await supabase.auth.admin.getUserById(p.user_id);
  const email = u?.user?.email?.toLowerCase();
  if (email?.endsWith(DOMINIO_CONTA_TECNICA)) return "tecnica";
  return "propria";
}

/**
 * Link de uso único pra entrar no painel, mandado pelo próprio WhatsApp do
 * produtor. A prova de que a pessoa é dona do cadastro é ela ter escrito pro
 * bot a partir daquele número (o número vem do webhook da Meta, não do
 * texto). Só vale pra conta sem login própria (sem_login/tecnica): quem já
 * tem e-mail e senha de verdade entra por eles, porque o número de WhatsApp
 * digitado num cadastro não prova, sozinho, que quem o controla é o dono
 * daquele login.
 *
 * Pra quem só tinha cadastro pelo WhatsApp, cria a conta técnica e vincula
 * ao cadastro na hora — sem CPF, sem senha; o painel então pede o e-mail e a
 * senha de verdade (CompletarAcessoCard).
 *
 * O link aponta pra uma página nossa (/acesso), não direto pro endereço de
 * verificação do Supabase: quem usa o token é o navegador, então pré-visualização
 * de link e robôs de mensagem não gastam o link de uso único.
 */
export async function gerarLinkDeAcesso(supabase: SupabaseClient, produtorId: string) {
  const { data: p } = await supabase
    .from("produtores")
    .select("id, whatsapp, user_id")
    .eq("id", produtorId)
    .maybeSingle();
  if (!p) return { sucesso: false as const, motivo: "sem_cadastro" as const };

  let email = `lead-${p.whatsapp}${DOMINIO_CONTA_TECNICA}`;

  if (p.user_id) {
    const { data: u } = await supabase.auth.admin.getUserById(p.user_id);
    const emailAtual = u?.user?.email?.toLowerCase();
    if (!emailAtual) return { sucesso: false as const, motivo: "erro" as const };
    if (!emailAtual.endsWith(DOMINIO_CONTA_TECNICA)) {
      return { sucesso: false as const, motivo: "tem_login_proprio" as const };
    }
    email = emailAtual;
  } else {
    let userId: string | null = null;
    const { data: existente } = await supabase.rpc("usuario_id_por_email", { p_email: email });
    if (typeof existente === "string") {
      // Sobra de um cadastro pelo formulário que bateu num cadastro do bot e
      // não terminou: a conta técnica existe, só não está ligada a ninguém.
      const { count } = await supabase
        .from("produtores")
        .select("id", { count: "exact", head: true })
        .eq("user_id", existente);
      if ((count ?? 0) > 0) return { sucesso: false as const, motivo: "erro" as const };
      userId = existente;
    } else {
      const { data: criado, error } = await supabase.auth.admin.createUser({
        email,
        password: crypto.randomUUID() + crypto.randomUUID(),
        email_confirm: true,
      });
      if (error || !criado?.user) return { sucesso: false as const, motivo: "erro" as const };
      userId = criado.user.id;
    }

    const { data: vinculado } = await supabase
      .from("produtores")
      .update({ user_id: userId })
      .eq("id", p.id)
      .is("user_id", null)
      .select("id")
      .maybeSingle();
    if (!vinculado) return { sucesso: false as const, motivo: "erro" as const };
  }

  const { data: link, error: erroLink } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const token = link?.properties?.hashed_token;
  if (erroLink || !token) return { sucesso: false as const, motivo: "erro" as const };

  return { sucesso: true as const, link: `${SITE_URL}/acesso?t=${encodeURIComponent(token)}` };
}
