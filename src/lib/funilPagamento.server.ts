import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { supabaseServiceRole } from "@/lib/supabase.server";

/**
 * Funil de pagamento dos últimos 7 dias, para o Matheus ver na tela Leads onde as pessoas travam (o resumo por WhatsApp
 * dependeria da janela de 24h do número dele). Só admin. Contas de teste (telefone 0090..., nomes QA/TESTE) ficam de fora.
 */
const EMAIL_ADMIN = "sirmatheus143@gmail.com";

export type FunilPagamento = {
  dias: number;
  etapas: { chave: string; rotulo: string; valor: number; dica?: string }[];
  emTeste: number;
  testeVenceEm3Dias: number;
};

const ehTeste = (nome: string | null | undefined, whatsapp: string | null | undefined) =>
  /\b(qa|teste|test)\b/i.test(nome ?? "") ||
  (whatsapp ?? "").startsWith("0090") ||
  (whatsapp ?? "").startsWith("00000");

const chave = (t: string | null | undefined) => {
  let d = (t ?? "").replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  return `${d.slice(0, 2)}${d.slice(-8)}`;
};

export async function calcularFunilPagamento(
  supabase: SupabaseClient,
  dias = 7,
): Promise<FunilPagamento> {
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
  const conv: { telefone: string; role: string; conteudo: string }[] = [];
  for (let pagina = 0; pagina < 10; pagina++) {
    const { data: lote } = await supabase
      .from("bot_conversas")
      .select("telefone, role, conteudo")
      .gte("created_at", desde)
      .order("created_at", { ascending: true })
      .range(pagina * 1000, pagina * 1000 + 999);
    conv.push(...((lote ?? []) as typeof conv));
    if ((lote?.length ?? 0) < 1000) break;
  }
  const [{ data: prods }, { data: ass }] = await Promise.all([
    supabase.from("produtores").select("id, nome, whatsapp, created_at"),
    supabase
      .from("assinaturas")
      .select(
        "produtor_id, status, asaas_subscription_id, trial_expira_em, updated_at, cancelada_em",
      ),
  ]);
  const reais = (prods ?? []).filter((p) => !ehTeste(p.nome as string, p.whatsapp as string));
  const idsReais = new Set(reais.map((p) => p.id as string));
  const telefonesReais = new Set(reais.map((p) => chave(p.whatsapp as string)));

  const quemFalou = (re: RegExp, role: string) => {
    const s = new Set<string>();
    for (const c of conv) {
      const k = chave(c.telefone);
      if (
        c.role === role &&
        re.test(c.conteudo ?? "") &&
        !k.startsWith("00") &&
        !k.startsWith("3799833")
      )
        s.add(k);
    }
    return s;
  };
  const doAnuncio = quemFalou(
    /posso\s+ter\s+mais\s+informa|quero\s+testar\s+o\s+safralume/i,
    "user",
  );
  const pediuAssinar = new Set(
    [
      ...quemFalou(
        /\b(quero|vou|gostaria de|preciso|como)\b.{0,20}\b(assinar|pagar)\b|^\s*(assinar|pagar)\s*$/i,
        "user",
      ),
    ].filter((k) => telefonesReais.has(k)),
  );
  const cobrancaPeloBot = quemFalou(/criei a sua assinatura/i, "assistant");

  const cadastros = reais.filter((p) => (p.created_at as string) >= desde).length;
  const mexeramNaCobranca = (ass ?? []).filter(
    (a) =>
      idsReais.has(a.produtor_id as string) &&
      a.asaas_subscription_id &&
      (a.updated_at as string) >= desde,
  );
  const pagaram = mexeramNaCobranca.filter((a) => a.status === "ativa").length;
  const cancelaram = (ass ?? []).filter(
    (a) =>
      idsReais.has(a.produtor_id as string) &&
      a.cancelada_em &&
      (a.cancelada_em as string) >= desde,
  ).length;
  const agora = Date.now();
  const emTeste = (ass ?? []).filter(
    (a) =>
      idsReais.has(a.produtor_id as string) &&
      a.status === "trial" &&
      a.trial_expira_em &&
      new Date(a.trial_expira_em as string).getTime() > agora,
  );
  const testeVenceEm3Dias = emTeste.filter(
    (a) => new Date(a.trial_expira_em as string).getTime() - agora <= 3 * 86_400_000,
  ).length;

  return {
    dias,
    etapas: [
      { chave: "anuncio", rotulo: "Mandaram a mensagem do anúncio", valor: doAnuncio.size },
      { chave: "cadastro", rotulo: "Se cadastraram (todas as origens)", valor: cadastros },
      {
        chave: "pediu",
        rotulo: "Cadastrados que pediram para assinar",
        valor: pediuAssinar.size,
        dica: 'escreveram "quero assinar/pagar" no WhatsApp',
      },
      {
        chave: "cobranca",
        rotulo: "Criaram a cobrança",
        valor: Math.max(cobrancaPeloBot.size, mexeramNaCobranca.length),
        dica: "pelo WhatsApp ou pelo site",
      },
      { chave: "pagou", rotulo: "Pagaram (conta ativa)", valor: pagaram },
      { chave: "cancelou", rotulo: "Cancelaram", valor: cancelaram },
    ],
    emTeste: emTeste.length,
    testeVenceEm3Dias,
  };
}

export const obterFunilPagamento = createServerFn({ method: "POST" })
  .validator(z.object({ accessToken: z.string().min(10) }))
  .handler(async ({ data }): Promise<FunilPagamento> => {
    const supabase = supabaseServiceRole();
    const { data: u, error } = await supabase.auth.getUser(data.accessToken);
    if (error || !u.user || u.user.email !== EMAIL_ADMIN) throw new Error("Acesso restrito.");
    return calcularFunilPagamento(supabase, 7);
  });
