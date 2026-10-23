import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { buscarFaturaParaPagar } from "@/lib/bot/faturaPendente";
import { supabaseServiceRole } from "@/lib/supabase.server";

/**
 * "Quem chamar hoje" (pedido do Matheus 2026-10-22: chamar as pessoas, não esperar elas voltarem, e converter o
 * máximo em pagantes). O template automático esbarra no bloqueio 131049 da Meta; a conversa pessoal do fundador é o que
 * funciona nesse volume. Só leitura, só para o admin: lê assinaturas, produtores e conversas com a chave de serviço e
 * devolve a lista priorizada. Roteiro no tom combinado: humano, alegre, sem citar bot, gancho real, sem cobrar.
 */
const EMAIL_ADMIN = "sirmatheus143@gmail.com";

export type Grupo =
  "tentou_pagar" | "cancelou" | "escrevendo" | "quente" | "ajudar" | "reconquistar" | "vencido";

export type PessoaParaChamar = {
  id: string;
  nome: string;
  primeiroNome: string;
  telefone: string;
  uf: string | null;
  cultura: string | null;
  grupo: Grupo;
  motivo: string;
  venceEmDias: number | null;
  mensagens: number;
  ultimaPergunta: string | null;
  script: string;
};

const digitos = (t: string | null | undefined) => (t ?? "").replace(/\D/g, "");
/** DDD + últimos 8 dígitos: casa número com e sem o 9º dígito (o WhatsApp devolve os antigos sem ele). */
const chave = (t: string | null | undefined) => {
  let d = digitos(t);
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  return `${d.slice(0, 2)}${d.slice(-8)}`;
};

function primeiroNomeLimpo(nome: string): string {
  const n = nome.trim().split(/\s+/)[0] ?? "";
  // "Ocupado", "Triste" etc. são o status do WhatsApp que vira nome de perfil, não nome de pessoa.
  if (
    !n ||
    n.length < 2 ||
    /^(produtor|produtora|qa|teste|test|ocupado|ocupada|triste|feliz|disponivel|disponível|dormindo|trabalhando|ausente|cliente|usuario|usuário)$/i.test(
      n,
    )
  )
    return "";
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
}

const PERGUNTA_REAL =
  /pre[cç]o|cota[cç]|quanto|clima|chuva|previs|soja|milho|caf[eé]|boi|arroba|saca|leite|cana|trigo|feij[aã]o|algod|frete|adubo|ureia|fertiliz|vender|vendo|valor/i;
const ROTULO_DE_BOTAO =
  /^(oi!? )?(quero ver meu pre[cç]o agora|tenho uma d[uú]vida|quero testar|quero)\b/i;

/** Última frase do produtor que parece pergunta de mercado de verdade (não botão, não "Sim", não nome). */
export function ultimaPerguntaReal(falas: { conteudo: string }[]): string | null {
  for (const x of [...falas].reverse()) {
    const t = x.conteudo.trim().replace(/^(oi|ol[aá]|bom dia|boa tarde|boa noite)[!,.\s]+/i, "");
    if (t.length < 12 || t.length > 110) continue;
    if (ROTULO_DE_BOTAO.test(t) || !PERGUNTA_REAL.test(t)) continue;
    return t.replace(/[.!\s]+$/, "");
  }
  return null;
}

const TESTES = /\b(qa|teste|test|fazenda b|sjsjs)\b/i;

function gancho(p: { cultura: string | null; ultimaPergunta: string | null }): string {
  if (p.ultimaPergunta) return `vi que você mandou "${p.ultimaPergunta}"`;
  if (p.cultura) return `vi que você trabalha com ${p.cultura.toLowerCase()}`;
  return "vi que você se cadastrou";
}

export function montarRoteiro(p: {
  grupo: Grupo;
  primeiroNome: string;
  cultura: string | null;
  ultimaPergunta: string | null;
  venceEmDias: number | null;
  linkFatura?: string | null;
}): string {
  const oi = p.primeiroNome ? `Oi, ${p.primeiroNome}! Tudo bem?` : "Oi! Tudo bem?";
  const eu = "Aqui é o Matheus, do Safralume (safralume.com.br).";
  const g = gancho(p);
  switch (p.grupo) {
    case "tentou_pagar":
      return `${oi} ${eu} Vi que você começou a assinar e o pagamento não chegou a ser concluído. Aconteceu algum problema na hora de pagar?${p.linkFatura ? ` Se foi só falta de tempo, o link direto é este (aceita Pix): ${p.linkFatura}` : ""} Se faltou alguma coisa pra você, me conta que eu ajusto 🌱`;
    case "cancelou":
      return `${oi} ${eu} Queria te agradecer por ter assinado e entender o que faltou pra você: foi pouco uso, preço, ou faltou algum dado? Sua resposta me ajuda muito a melhorar. Se um dia quiser voltar, é só me avisar 🌱`;
    case "escrevendo":
      return `${oi} ${eu} Tenho visto você mandar as novidades e as contas da safra por aqui e adoro acompanhar. Seu teste terminou e eu não quero que você fique sem resposta: me conta, o que mais te ajudaria no dia a dia? Se quiser continuar, te mando o link na hora 🌱`;
    case "quente":
      return `${oi} ${eu} ${g[0]!.toUpperCase()}${g.slice(1)} e queria saber: tem ajudado no seu dia a dia? Se tiver algo que você sente falta ou que não ficou claro, me conta que eu resolvo por aqui mesmo 🌱`;
    case "ajudar":
      return `${oi} ${eu} Vi que você entrou${p.cultura ? ` pra acompanhar ${p.cultura.toLowerCase()}` : ""} e ainda não deu pra testar direito. Quer que eu te mostre rapidinho como ver o preço da sua região? É só me mandar o nome da cidade que eu te respondo agora 🌱`;
    case "reconquistar":
      return `${oi} ${eu} ${g[0]!.toUpperCase()}${g.slice(1)}. Faz uns dias que a gente não se fala e queria saber se faltou alguma coisa pra ser útil pra você. Posso ajudar em algo hoje? 🌱`;
    case "vencido":
      return `${oi} ${eu} Seu teste terminou há alguns dias e eu fiquei curioso: o que achou? Se faltou alguma coisa, me fala que a gente ajusta. Se quiser voltar, é só me avisar 🌱`;
  }
}

/** Monta a lista priorizada (separada do servidor para poder ser testada contra o banco). */
export async function montarListaParaChamar(supabase: SupabaseClient): Promise<PessoaParaChamar[]> {
  const agora = Date.now();
  const desde = new Date(agora - 45 * 86_400_000).toISOString();
  const [{ data: ass }, { data: prods }] = await Promise.all([
    supabase
      .from("assinaturas")
      .select("produtor_id, status, trial_expira_em")
      .eq("status", "trial"),
    supabase.from("produtores").select("id, nome, whatsapp, uf, cultura_principal, created_at"),
  ]);
  // O PostgREST devolve no máximo 1000 linhas por chamada: pagina até acabar (ou 8 páginas).
  const conv: { telefone: string; conteudo: string; created_at: string }[] = [];
  for (let pagina = 0; pagina < 8; pagina++) {
    const { data: lote } = await supabase
      .from("bot_conversas")
      .select("telefone, conteudo, created_at")
      .eq("role", "user")
      .gte("created_at", desde)
      .order("created_at", { ascending: true })
      .range(pagina * 1000, pagina * 1000 + 999);
    conv.push(...((lote ?? []) as typeof conv));
    if ((lote?.length ?? 0) < 1000) break;
  }

  const porProdutor = new Map((prods ?? []).map((p) => [p.id as string, p]));
  const falas = new Map<string, { conteudo: string; created_at: string }[]>();
  for (const c of conv) {
    const k = chave(c.telefone);
    const l = falas.get(k) ?? [];
    l.push({ conteudo: c.conteudo, created_at: c.created_at });
    falas.set(k, l);
  }

  const lista: PessoaParaChamar[] = [];
  for (const a of ass ?? []) {
    const p = porProdutor.get(a.produtor_id as string);
    if (!p || !p.whatsapp || !a.trial_expira_em) continue;
    if (TESTES.test(String(p.nome ?? ""))) continue;
    const vence = (new Date(a.trial_expira_em as string).getTime() - agora) / 86_400_000;
    const f = falas.get(chave(p.whatsapp as string)) ?? [];
    const mensagens = f.length;
    const ultimaPergunta = ultimaPerguntaReal(f);
    const diasDesdeUltima = f.length
      ? (agora - new Date(f[f.length - 1]!.created_at).getTime()) / 86_400_000
      : null;

    let grupo: Grupo;
    let motivo: string;
    if (vence < 0 && diasDesdeUltima !== null && diasDesdeUltima <= 3 && mensagens >= 2) {
      // Venceu mas segue escrevendo: está batendo no aviso de assinatura. É quem mais vale chamar.
      grupo = "escrevendo";
      motivo = `Teste venceu há ${Math.ceil(-vence)} dia(s) e continua escrevendo (última mensagem há ${Math.floor(diasDesdeUltima)} dia(s), ${mensagens} no total); só recebe o aviso de assinar`;
    } else if (vence < -10) {
      continue; // vencido há mais de 10 dias e sem escrever: esfriou
    } else if (vence < 0) {
      if (mensagens === 0) continue; // nunca usou e já venceu: sem gancho, fica para a reativação
      grupo = "vencido";
      motivo = `Teste venceu há ${Math.ceil(-vence)} dia(s); conversou ${mensagens}x`;
    } else if (mensagens === 0) {
      grupo = "ajudar";
      motivo = `Nunca mandou mensagem; teste acaba em ${Math.ceil(vence)} dia(s)`;
    } else if (diasDesdeUltima !== null && diasDesdeUltima > 3) {
      grupo = "reconquistar";
      motivo = `Sumiu há ${Math.floor(diasDesdeUltima)} dias (${mensagens} msgs); teste acaba em ${Math.ceil(vence)} dia(s)`;
    } else {
      grupo = "quente";
      motivo = `Usando agora (${mensagens} msgs); teste acaba em ${Math.ceil(vence)} dia(s)`;
    }

    const nome = String(p.nome ?? "");
    const primeiroNome = primeiroNomeLimpo(nome);
    const cultura = (p.cultura_principal as string | null) ?? null;
    lista.push({
      id: p.id as string,
      nome: nome || "Sem nome",
      primeiroNome,
      telefone: digitos(p.whatsapp as string),
      uf: (p.uf as string | null) ?? null,
      cultura,
      grupo,
      motivo,
      venceEmDias: Math.round(vence * 10) / 10,
      mensagens,
      ultimaPergunta,
      script: montarRoteiro({ grupo, primeiroNome, cultura, ultimaPergunta, venceEmDias: vence }),
    });
  }

  // Quem já tentou pagar (1ª fatura vencida) ou cancelou há pouco: o contato pessoal mais valioso. A Asaas dá o link da fatura.
  const { data: tentaram } = await supabase
    .from("assinaturas")
    .select("produtor_id, status, plano, cancelada_em, motivo_cancelamento")
    .or(
      `and(status.eq.inadimplente,asaas_subscription_id.not.is.null),and(status.eq.cancelada,cancelada_em.gte.${new Date(agora - 14 * 86_400_000).toISOString()})`,
    );
  for (const a of tentaram ?? []) {
    const p = porProdutor.get(a.produtor_id as string);
    if (!p || !p.whatsapp || TESTES.test(String(p.nome ?? ""))) continue;
    const f = falas.get(chave(p.whatsapp as string)) ?? [];
    const nome = String(p.nome ?? "");
    const primeiroNome = primeiroNomeLimpo(nome);
    const cultura = (p.cultura_principal as string | null) ?? null;
    const grupo: Grupo = a.status === "cancelada" ? "cancelou" : "tentou_pagar";
    const fatura =
      grupo === "tentou_pagar" ? await buscarFaturaParaPagar(supabase, p.id as string) : null;
    lista.push({
      id: p.id as string,
      nome: nome || "Sem nome",
      primeiroNome,
      telefone: digitos(p.whatsapp as string),
      uf: (p.uf as string | null) ?? null,
      cultura,
      grupo,
      motivo:
        grupo === "tentou_pagar"
          ? `Começou a assinar o plano ${a.plano} e o pagamento não foi concluído${fatura ? ` (fatura de R$ ${fatura.valor}, vence ${fatura.vencimento.slice(8, 10)}/${fatura.vencimento.slice(5, 7)})` : ""}`
          : `Cancelou em ${String(a.cancelada_em ?? "").slice(8, 10)}/${String(a.cancelada_em ?? "").slice(5, 7)}${a.motivo_cancelamento ? ` (motivo: ${String(a.motivo_cancelamento).replaceAll("_", " ")})` : ""}`,
      venceEmDias: null,
      mensagens: f.length,
      ultimaPergunta: null,
      script: montarRoteiro({
        grupo,
        primeiroNome,
        cultura,
        ultimaPergunta: null,
        venceEmDias: null,
        linkFatura: fatura?.url ?? null,
      }),
    });
  }

  const peso: Record<Grupo, number> = {
    tentou_pagar: -2,
    cancelou: -1,
    escrevendo: 0,
    quente: 1,
    ajudar: 2,
    reconquistar: 3,
    vencido: 4,
  };
  return lista.sort(
    (a, b) =>
      peso[a.grupo] - peso[b.grupo] ||
      (a.venceEmDias ?? 99) - (b.venceEmDias ?? 99) ||
      b.mensagens - a.mensagens,
  );
}

export const listarQuemChamarHoje = createServerFn({ method: "POST" })
  .validator(z.object({ accessToken: z.string().min(10) }))
  .handler(async ({ data }): Promise<PessoaParaChamar[]> => {
    const supabase = supabaseServiceRole();
    const { data: u, error } = await supabase.auth.getUser(data.accessToken);
    if (error || !u.user || u.user.email !== EMAIL_ADMIN) throw new Error("Acesso restrito.");
    return montarListaParaChamar(supabase);
  });
