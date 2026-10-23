import { PERGUNTA_CULTURA } from "@/lib/bot/cadastroConversa";

/**
 * Lembrete, DENTRO da janela de 24h, para quem veio do anúncio (ou do botão "testar") e parou no meio do cadastro pelo
 * WhatsApp. Medido em 23/10: de 57 leads de anúncio em 7 dias, 30 (53%) mandaram a 1ª mensagem e nunca responderam ao menu, e só
 * 12 (21%) viraram cadastro; quem converte, converte em minutos (mediana 4), mas há quem volte horas depois. Dentro da janela a
 * mensagem é livre (sem modelo, sem o filtro 131049 da Meta). Uma vez só por pessoa, só em horário comercial.
 * A lógica de quem entra e o texto ficam aqui, puros, para testar sem banco.
 */
export const MARCA_DO_LEMBRETE = "Ficou faltando só um passo";

export type Linha = {
  telefone: string;
  role: "user" | "assistant";
  conteudo: string;
  created_at: string;
};

export type Candidato = {
  telefone: string;
  texto: string;
  passo: "cultura" | "estado" | "cafe" | "confirma";
  minutosParado: number;
};

const AVISOU_EQUIPE = /já avisei a nossa equipe|a nossa equipe já foi avisada/i;
const PEDIU_PARA_SAIR =
  /\b(sair|parar|n[aã]o quero|sem interesse|n[aã]o tenho interesse|remov\w+|me tira\w*)\b/i;
const VEIO_DO_ANUNCIO = /posso\s+ter\s+mais\s+informa|quero\s+testar/i;
const NUMERO_DE_TESTE = /^55(00900|11900000|3799833)/;

/** Qual pergunta do cadastro ficou sem resposta, lida na última mensagem do bot. */
export function perguntaPendente(
  ultimaDoBot: string,
): { passo: Candidato["passo"]; pergunta: string } | null {
  if (/Confirma:\s*crio seu cadastro/i.test(ultimaDoBot)) {
    return { passo: "confirma", pergunta: ultimaDoBot.trim() };
  }
  if (/ar[aá]bica ou conillon|1 Ar[aá]bica/i.test(ultimaDoBot)) {
    return { passo: "cafe", pergunta: ultimaDoBot.trim() };
  }
  if (/Em qual estado/i.test(ultimaDoBot)) {
    return { passo: "estado", pergunta: ultimaDoBot.trim() };
  }
  if (/o que você produz/i.test(ultimaDoBot)) {
    return { passo: "cultura", pergunta: PERGUNTA_CULTURA };
  }
  return null;
}

/**
 * Quem recebe o lembrete agora. `jaCadastrados` e `jaLembrados` vêm do banco (chaves = últimos 8 dígitos + DDD).
 * Regras: a última mensagem é do bot (a pessoa é quem deve responder), ela veio do anúncio, ficou parada de 60 min a 20 h,
 * a janela de 24h ainda está aberta, nunca foi lembrada, não pediu para sair e não foi passada para a equipe.
 */
export function escolherCandidatos(
  linhas: Linha[],
  opcoes: {
    agora: number;
    jaCadastrados: Set<string>;
    jaLembrados: Set<string>;
    optout: Set<string>;
    chave: (t: string) => string;
    max: number;
  },
): Candidato[] {
  const porTelefone = new Map<string, Linha[]>();
  for (const l of [...linhas].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const k = l.telefone;
    porTelefone.set(k, [...(porTelefone.get(k) ?? []), l]);
  }
  const saida: Candidato[] = [];
  for (const [telefone, msgs] of porTelefone) {
    if (NUMERO_DE_TESTE.test(telefone)) continue;
    const k = opcoes.chave(telefone);
    if (opcoes.jaCadastrados.has(k) || opcoes.jaLembrados.has(k) || opcoes.optout.has(k)) continue;
    const ultima = msgs[msgs.length - 1]!;
    if (ultima.role !== "assistant") continue;
    const users = msgs.filter((m) => m.role === "user");
    if (users.length === 0) continue;
    if (!users.some((m) => VEIO_DO_ANUNCIO.test(m.conteudo))) continue;
    if (users.some((m) => PEDIU_PARA_SAIR.test(m.conteudo))) continue;
    if (
      msgs.some(
        (m) =>
          m.role === "assistant" &&
          (AVISOU_EQUIPE.test(m.conteudo) || m.conteudo.includes(MARCA_DO_LEMBRETE)),
      )
    ) {
      continue;
    }
    const minutosParado = (opcoes.agora - Date.parse(ultima.created_at)) / 60_000;
    const horasDesdeUltimaFala =
      (opcoes.agora - Date.parse(users[users.length - 1]!.created_at)) / 3_600_000;
    if (minutosParado < 60 || horasDesdeUltimaFala > 20) continue;
    const p = perguntaPendente(ultima.conteudo);
    if (!p) continue;
    saida.push({
      telefone,
      passo: p.passo,
      minutosParado: Math.round(minutosParado),
      texto: `Oi! ${MARCA_DO_LEMBRETE} pro seu teste grátis de 7 dias 🌱\n\n${p.pergunta}`,
    });
    if (saida.length >= opcoes.max) break;
  }
  return saida;
}
