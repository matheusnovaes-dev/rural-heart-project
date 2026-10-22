import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizarWhatsapp } from "@/lib/telefone";
import type { HistoricoLinha } from "@/lib/bot/prompt";
import { trackConversaoServidor } from "@/lib/metaCapi.server";
import { culturaMencionada, normalizarCultura } from "@/config/culturas";

// Mesma rede de segurança determinística usada em alertas.ts: o prompt já
// exige confirmação numa mensagem separada antes de criar a conta, mas
// testando ao vivo o modelo às vezes pula direto pra criação na primeira
// mensagem — não vale o risco de criar conta sem confirmação real, então
// exige que a ÚLTIMA mensagem do assistente já seja essa pergunta.
function aindaPrecisaConfirmar(historico: HistoricoLinha[]): boolean {
  const ordenado = [...historico].sort((a, b) => a.ordem - b.ordem);
  const ultima = [...ordenado].reverse().find((h) => h.role === "assistant")?.conteudo;
  if (!ultima) return true;
  return !(/confirma/i.test(ultima) && /(conta|cadastr)/i.test(ultima));
}

// Achado real 2026-10-11: produtor respondeu "música, sou do funk" quando
// perguntado a cultura, o modelo mesmo assim propôs "SOJA" na pergunta de
// confirmação (cultura real, só que inventada — o produtor nunca disse
// soja), e a confirmação vaga dele na mensagem seguinte ("ah sim entendi")
// bateria no regex de aindaPrecisaConfirmar acima, que só olha a ÚLTIMA
// mensagem do assistente, não se a cultura dela apareceu de verdade na
// fala do produtor. Mesma rede de segurança que os alertas já têm pro
// valor (nunca criar com um número que o produtor não disse): aqui a
// cultura só é aceita se alguma mensagem DO PRODUTOR (texto atual ou
// histórico) de fato mencionar essa cultura — nunca a que só o bot propôs.
function culturaConfirmadaPeloProdutor(
  culturaAlvo: string,
  textoAtual: string,
  historico: HistoricoLinha[],
): boolean {
  const alvo = normalizarCultura(culturaAlvo);
  const falasDoProdutor = [
    textoAtual,
    ...historico.filter((h) => h.role === "user").map((h) => h.conteudo),
  ];
  return falasDoProdutor.some((fala) => culturaMencionada(fala) === alvo);
}

/** Texto pré-preenchido do anúncio de Mensagens (clique para o WhatsApp). */
const TEXTO_DO_ANUNCIO = /posso\s+ter\s+mais\s+informa[çc][õo]es\s+sobre\s+isso/i;

/**
 * Origem de quem se cadastra conversando no WhatsApp. Antes ficava em branco (75 de 100 cadastros em 30 dias),
 * e sem isso não dá para saber quanto custa um cadastro do anúncio de Mensagens. Mesmo vocabulário do site
 * (origem, utm_source, utm_medium, utm_campaign).
 */
export function origemDoCadastroPeloWhatsapp(
  texto: string,
  historico: { role: string; conteudo: string }[],
): { origem: string; utm_source?: string; utm_medium?: string } {
  const doAnuncio =
    TEXTO_DO_ANUNCIO.test(texto) ||
    historico.some((h) => h.role === "user" && TEXTO_DO_ANUNCIO.test(h.conteudo));
  return doAnuncio
    ? { origem: "anuncio_whatsapp", utm_source: "meta_ads", utm_medium: "click_to_whatsapp" }
    : { origem: "whatsapp" };
}

/**
 * Cadastro de teste (7 dias, plano Bronze, sem cartão) criado direto na
 * conversa do WhatsApp — pra quem chegou via anúncio e não quer sair pro
 * site preencher formulário. Sem CPF/CNPJ e sem login no painel ainda
 * (isso fica pra quando/se ele quiser acessar o painel web depois); o
 * produtor já sai dessa conversa recebendo preço/alerta/clima como
 * qualquer assinante Bronze.
 */
export async function criarContaTeste(
  supabase: SupabaseClient,
  args: { uf: string; cultura_principal: string },
  ctx: {
    telefone: string;
    texto: string;
    produtor: { nome: string; user_id: string | null };
    historico: HistoricoLinha[];
    /** O cadastro conversacional por código já leu a cultura da fala (ou do menu numerado) do produtor. */
    culturaVemDoProdutor?: boolean;
  },
) {
  if (ctx.produtor.user_id) {
    return { sucesso: false, motivo: "ja_tem_conta" };
  }
  if (aindaPrecisaConfirmar(ctx.historico)) {
    return { sucesso: false, motivo: "precisa_confirmar_primeiro" };
  }
  if (
    !ctx.culturaVemDoProdutor &&
    !culturaConfirmadaPeloProdutor(args.cultura_principal, ctx.texto, ctx.historico)
  ) {
    return { sucesso: false, motivo: "cultura_nao_confirmada" };
  }

  const whatsapp = normalizarWhatsapp(ctx.telefone);

  const { data: existente } = await supabase
    .from("produtores")
    .select("id")
    .eq("whatsapp", whatsapp)
    .maybeSingle();
  if (existente) {
    return { sucesso: false, motivo: "ja_tem_conta" };
  }

  const base = {
    nome: ctx.produtor.nome || "Produtor",
    whatsapp,
    cultura_principal: args.cultura_principal,
    uf: args.uf,
  };
  const comOrigem = { ...base, ...origemDoCadastroPeloWhatsapp(ctx.texto, ctx.historico) };
  let { data: produtor, error: erroProdutor } = await supabase
    .from("produtores")
    .insert(comOrigem)
    .select("id")
    .single();
  // Se a coluna rejeitar o valor de origem (restrição que não conheço), cria sem ela: a conta vale mais que a estatística.
  if (erroProdutor && erroProdutor.code !== "23505") {
    ({ data: produtor, error: erroProdutor } = await supabase
      .from("produtores")
      .insert(base)
      .select("id")
      .single());
  }
  // Corrida rara (duas mensagens quase simultâneas confirmando ao mesmo
  // tempo): a constraint unique em `whatsapp` pega o que o SELECT acima
  // não pegou — trata como "já tem conta", não como erro de verdade.
  if (erroProdutor) {
    return {
      sucesso: false,
      motivo: erroProdutor.code === "23505" ? "ja_tem_conta" : "erro_ao_criar",
    };
  }
  if (!produtor) {
    return { sucesso: false, motivo: "erro_ao_criar" };
  }

  const { error: erroAssinatura } = await supabase
    .from("assinaturas")
    .insert({ produtor_id: produtor.id, plano: "bronze" });
  if (erroAssinatura) {
    return { sucesso: false, motivo: "erro_ao_criar" };
  }

  // Conversão de verdade pro Meta Ads: mesmo evento (CompleteRegistration)
  // que o site dispara, só que via CAPI direto — não existe navegador aqui
  // (chamada servidor-a-servidor do n8n), então o Pixel do lado do cliente
  // nunca entra em jogo. Achado 2026-09-17 junto com o mesmo bug no
  // LeadForm: cadastro pelo bot (a campanha de Mensagens inteira depende
  // disso) completava a conta de verdade sem nunca reportar a conversão.
  void trackConversaoServidor({
    data: { eventId: crypto.randomUUID(), plano: "bronze", whatsapp },
  });

  return { sucesso: true, uf: args.uf, cultura_principal: args.cultura_principal };
}
