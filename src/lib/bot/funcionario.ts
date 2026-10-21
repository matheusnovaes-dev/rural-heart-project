/**
 * Funcionário lançando no Caderno da fazenda pelo WhatsApp (plano Prata e Ouro).
 *
 * O número do funcionário (cadastrado pelo dono na tela Funcionários) manda "gastei 800 de diesel" ou "colhi 500 sacas
 * no talhão 2" para o Safralume e o lançamento entra no caderno do dono, marcado com o nome de quem lançou. Regras:
 *   - só gasto, plantio, colheita e anotação (venda, a pagar e a receber, estoque e meta são do dono);
 *   - gasto de até R$ 20.000 por lançamento (acima disso o dono lança);
 *   - o funcionário NÃO vê totais, resumo nem preços da fazenda (só o que ele mesmo lançou hoje);
 *   - "desfazer" só apaga o que ele mesmo lançou nas últimas 3 horas.
 * O dono vê tudo na tela Fazenda, com o nome de quem lançou.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { buildContextoDeData } from "@/lib/bot/guardas";
import { temAcessoPrata } from "@/lib/planos.shared";
import {
  hojeBrasilia,
  descreverRegistro,
  formatarReais,
  COLUNAS_REGISTRO,
  type RegistroFazenda,
  type TipoRegistro,
} from "@/lib/fazenda.shared";
import type { HistoricoLinha } from "@/lib/bot/prompt";
import { TOOLS } from "@/lib/bot/tools";
import { mensagemBloqueioAcesso, verificarAcessoWhatsapp } from "@/lib/bot/tools/acesso";
import {
  afirmaTerAnotadoNoCaderno,
  desfazerUltimoRegistro,
  ehPedidoDeDesfazerRegistro,
  pareceLancamentoNoCaderno,
  registrarNaFazenda,
} from "@/lib/bot/tools/fazenda";
import { SEM_ACENTO, planoDoProdutor } from "@/lib/bot/tools/fazendaBase";
import type { ProdutorContexto } from "@/lib/bot/types";

export type Funcionario = { id: string; nome: string; produtor_id: string };

export const LIMITE_DE_VALOR_DO_FUNCIONARIO = 20_000;
const TIPOS_DO_FUNCIONARIO: TipoRegistro[] = ["gasto", "plantio", "colheita", "nota"];

type Resposta = {
  resposta: string;
  precisa_humano: boolean;
  cadastro_criado: boolean;
  convite_dispensado: boolean;
};

const pronta = (resposta: string): Resposta => ({
  resposta,
  precisa_humano: false,
  cadastro_criado: false,
  convite_dispensado: true,
});

/** O número é de um funcionário cadastrado? Casa pelos 8 últimos dígitos (com ou sem 9º dígito e com ou sem 55). */
export async function acharFuncionario(
  supabase: SupabaseClient,
  telefone: string,
): Promise<Funcionario | null> {
  const digitos = telefone.replace(/\D/g, "");
  if (digitos.length < 10) return null;
  const ult8 = digitos.slice(-8);
  const { data, error } = await supabase
    .from("funcionarios")
    .select("id, nome, whatsapp, produtor_id")
    .like("whatsapp", `%${ult8}`)
    .limit(5);
  if (error) {
    console.error("Erro ao procurar funcionário:", error);
    return null;
  }
  const achado = (
    (data ?? []) as { id: string; nome: string; whatsapp: string; produtor_id: string }[]
  ).find((f) => f.whatsapp.replace(/\D/g, "").slice(-8) === ult8);
  return achado ? { id: achado.id, nome: achado.nome, produtor_id: achado.produtor_id } : null;
}

const AJUDA = (nome: string, dono: string) =>
  `Oi, ${nome.trim().split(" ")[0] || nome}! Por aqui você anota gasto, plantio e colheita da fazenda de ${dono}. É só escrever, por exemplo: "gastei 800 de diesel", "plantei soja no talhão 2" ou "colhi 500 sacas". Pra desfazer o último lançamento seu, diga "desfazer". Outros assuntos você resolve direto com ${dono}.`;

const SISTEMA = (nome: string, dono: string) =>
  `Você anota lançamentos da fazenda de ${dono} para o funcionário ${nome}, pelo WhatsApp. Fale em português simples e curto.
- Quando ele disser que gastou, pagou, comprou, plantou ou colheu algo, chame registrar_na_fazenda com o que ele disse (valor total em reais como número; 12 mil = 12000).
- Se faltar o valor de um gasto, NÃO chame: pergunte só "Quanto foi?".
- Venda, conta a pagar ou a receber, estoque e valores acima de ${formatarReais(LIMITE_DE_VALOR_DO_FUNCIONARIO)} são do dono: se a ferramenta recusar (motivo nao_permitido ou acima_do_limite), explique isso em uma frase e diga que ${dono} precisa lançar.
- NUNCA fale de preço de mercado, totais, saldo ou números da fazenda. NUNCA diga que anotou sem a ferramenta confirmar (sucesso=true).`;

function ferramentaDoFuncionario() {
  const base = TOOLS.find((t) => t.function.name === "registrar_na_fazenda")!;
  const clone = JSON.parse(JSON.stringify(base)) as {
    type: string;
    function: {
      name: string;
      description: string;
      parameters: { properties: Record<string, { enum?: string[] }> };
    };
  };
  clone.function.parameters.properties["tipo"]!.enum = TIPOS_DO_FUNCIONARIO;
  delete clone.function.parameters.properties["vence_em"];
  return clone;
}

async function chamarModelo(
  apiKey: string,
  messages: unknown[],
  signal: AbortSignal,
): Promise<{
  content: string | null;
  tool_calls?: { id: string; function: { name: string; arguments: string } }[];
} | null> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages,
      tools: [ferramentaDoFuncionario()],
    }),
  });
  if (!res.ok) {
    console.error("Funcionário: erro do modelo", res.status, (await res.text()).slice(0, 200));
    return null;
  }
  const json = (await res.json()) as {
    choices?: {
      message?: {
        content: string | null;
        tool_calls?: { id: string; function: { name: string; arguments: string } }[];
      };
    }[];
  };
  return json.choices?.[0]?.message ?? null;
}

export async function responderFuncionario(input: {
  supabase: SupabaseClient;
  apiKey: string;
  signal: AbortSignal;
  telefone: string;
  texto: string;
  historico: HistoricoLinha[];
  funcionario: Funcionario;
  temMidia?: boolean;
}): Promise<Resposta> {
  const { supabase, apiKey, signal, telefone, texto, historico, funcionario } = input;
  const { data: d } = await supabase
    .from("produtores")
    .select("id, nome, uf, cultura_principal, municipio, lat, lon, user_id")
    .eq("id", funcionario.produtor_id)
    .maybeSingle<ProdutorContexto>();
  if (!d)
    return pronta(
      "Não achei a fazenda ligada ao seu número. Fale com o dono pra conferir o cadastro.",
    );
  const dono: ProdutorContexto = d;
  const primeiroDono = dono.nome.trim().split(" ")[0] || dono.nome;

  const acesso = await verificarAcessoWhatsapp(supabase, dono.id!);
  if (!acesso.liberado)
    return pronta(
      mensagemBloqueioAcesso(acesso.comLogin, acesso.motivo).split("\n")[0] ??
        "O acesso dessa fazenda está suspenso. Fale com o dono.",
    );
  const plano = await planoDoProdutor(supabase, dono.id);
  if (!temAcessoPrata(plano)) {
    return pronta(
      `Lançar pelo WhatsApp é um recurso do plano Prata da fazenda. Peça pra ${primeiroDono} conferir o plano.`,
    );
  }
  if (input.temMidia) {
    return pronta(
      "Por enquanto eu só anoto por mensagem escrita ou áudio. Se for nota ou recibo, mande pro dono lançar.",
    );
  }

  const t = SEM_ACENTO(texto)
    .replace(/[?!.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // desfazer o que ele mesmo lançou
  if (
    ehPedidoDeDesfazerRegistro(texto, historico) ||
    /^(desfaz\w*|apaga o ultimo|apague o ultimo)$/.test(t)
  ) {
    const r = await desfazerUltimoRegistro(supabase, dono, { nome: funcionario.nome });
    return pronta(r.texto);
  }
  // o que ele lançou hoje (nunca os totais da fazenda)
  if (/\b(o que (eu )?(lancei|anotei)|meus lancamentos|minhas anotacoes)\b/.test(t)) {
    const hoje = hojeBrasilia();
    const { data } = await supabase
      .from("fazenda_registros")
      .select(COLUNAS_REGISTRO)
      .eq("produtor_id", dono.id!)
      .eq("origem", "funcionario")
      .eq("lancado_por", funcionario.nome)
      .is("apagado_em", null)
      .gte("criado_em", `${hoje}T03:00:00.000Z`)
      .order("criado_em", { ascending: false })
      .limit(10);
    const linhas = ((data ?? []) as RegistroFazenda[]).map((r) => `  • ${descreverRegistro(r)}`);
    return pronta(
      linhas.length
        ? `O que você anotou hoje:\n${linhas.join("\n")}`
        : "Você ainda não anotou nada hoje.",
    );
  }
  // venda, a pagar e a receber e estoque são do dono: recusa por código, sem gastar o modelo
  if (
    /\b(vendi|vendemos|vendeu|recebi|recebemos|a receber|a pagar|tenho que pagar|vou pagar|vou receber|estoque|armazem)\b/.test(
      t,
    )
  ) {
    return pronta(
      `Venda, conta a pagar ou a receber e estoque são com ${primeiroDono}. Por aqui eu anoto gasto, plantio e colheita.`,
    );
  }
  if (!pareceLancamentoNoCaderno(texto)) return pronta(AJUDA(funcionario.nome, primeiroDono));

  // lançamento: o modelo só entende a frase; a gravação e as travas são por código
  const mensagens: unknown[] = [
    { role: "system", content: SISTEMA(funcionario.nome, primeiroDono) },
    { role: "system", content: buildContextoDeData() },
    ...[...historico]
      .sort((a, b) => a.ordem - b.ordem)
      .slice(-8)
      .map((h) => ({ role: h.role, content: h.conteudo })),
    { role: "user", content: texto },
  ];
  const confirmacoes: string[] = [];
  let ultimaFalha = false;
  for (let rodada = 0; rodada < 3; rodada++) {
    const msg = await chamarModelo(apiKey, mensagens, signal);
    if (!msg) break;
    if (msg.tool_calls?.length) {
      mensagens.push({
        role: "assistant",
        content: msg.content ?? null,
        tool_calls: msg.tool_calls,
      });
      const jaFeitas = new Map<string, Promise<unknown>>();
      const resultados = await Promise.all(
        msg.tool_calls.map(async (tc) => {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(tc.function.arguments || "{}");
          } catch {
            args = {};
          }
          const chave = JSON.stringify(args);
          let p = jaFeitas.get(chave);
          if (!p) {
            p = registrarNaFazenda(supabase, args as Parameters<typeof registrarNaFazenda>[1], {
              produtor: dono,
              texto,
              historico,
              telefone,
              lancadoPor: funcionario.nome,
              tiposPermitidos: TIPOS_DO_FUNCIONARIO,
              limiteDeValor: LIMITE_DE_VALOR_DO_FUNCIONARIO,
              plano,
            });
            jaFeitas.set(chave, p);
          }
          return { id: tc.id, resultado: (await p) as { sucesso?: boolean; confirmacao?: string } };
        }),
      );
      for (const r of resultados) {
        mensagens.push({ role: "tool", tool_call_id: r.id, content: JSON.stringify(r.resultado) });
        if (r.resultado.sucesso && r.resultado.confirmacao)
          confirmacoes.push(r.resultado.confirmacao);
        else ultimaFalha = true;
      }
      if (confirmacoes.length > 0 && !ultimaFalha)
        return pronta([...new Set(confirmacoes)].join("\n"));
      continue;
    }
    const resp = (msg.content ?? "").trim();
    if (!resp) break;
    // "anotei" sem ter gravado nada é promessa vazia
    if (afirmaTerAnotadoNoCaderno(resp) && confirmacoes.length === 0) {
      return pronta(
        `Ainda não anotei. Me diga o que foi e quanto, por exemplo: "gastei 800 de diesel".`,
      );
    }
    return pronta(
      confirmacoes.length
        ? [...new Set(confirmacoes)].join("\n") + (ultimaFalha ? `\n${resp}` : "")
        : resp,
    );
  }
  return pronta(
    confirmacoes.length
      ? [...new Set(confirmacoes)].join("\n")
      : AJUDA(funcionario.nome, primeiroDono),
  );
}
