import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizarCultura } from "@/config/culturas";
import { ufs } from "@/config/ufs";
import { buscarPreco } from "@/lib/bot/tools/preco";
import { buscarFerrugemAsiatica } from "@/lib/bot/tools/ferrugem";
import { buscarProgressoSafraConab } from "@/lib/bot/tools/mercado";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const mesAno = (iso: string) => `${MESES[Number(iso.slice(5, 7)) - 1]}/${iso.slice(2, 4)}`;
const nomeDaUf = (uf: string) => ufs.find((u) => u.value === uf)?.label ?? uf;
const brl = (n: number) => `R$${n.toFixed(2).replace(".", ",")}`;
const pct = (fracao: number) =>
  `${(fracao * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/**
 * Resumo de retomada — pedido do Matheus 2026-09-30: produtor some depois
 * da primeira conversa (achado real analisando os 28 cadastros: 18 nunca
 * mandaram mensagem nenhuma, os outros quase todos sumiram na mesma sessão
 * do cadastro). Em vez de um "quer saber o preço de hoje?" genérico, monta
 * um resumo com dado REAL e específico do produtor (cultura+UF dele),
 * reaproveitando as MESMAS funções que o bot usa pra responder de verdade
 * — nunca um texto fixo, sempre o que existir de real pra ele agora.
 * Degrada graciosamente: cada pedaço só entra se tiver dado de verdade.
 */
export async function montarResumoReengajamento(
  supabase: SupabaseClient,
  produtor: { uf: string; cultura_principal: string },
): Promise<string | null> {
  const cultura = normalizarCultura(produtor.cultura_principal);
  const uf = produtor.uf;
  const partes: string[] = [];

  const [preco, progresso, ferrugem] = await Promise.all([
    buscarPreco(supabase, { produto: cultura, uf, incluir_frete: false }).catch(() => null),
    buscarProgressoSafraConab(supabase, { produto: cultura, uf }).catch(() => null),
    cultura === "soja"
      ? buscarFerrugemAsiatica(supabase, { uf }).catch(() => null)
      : Promise.resolve(null),
  ]);

  // Ferrugem primeiro, de propósito: é o dado mais urgente quando existe
  // (risco real pra lavoura), tem que vir antes do preço.
  if (ferrugem?.encontrado && ferrugem.municipios_com_ocorrencia_confirmada.length > 0) {
    const municipios = ferrugem.municipios_com_ocorrencia_confirmada
      .slice(0, 3)
      .map((m) => m.municipio)
      .join(", ");
    partes.push(
      `Atenção: já tem foco confirmado de ferrugem asiática em ${municipios} esta safra.`,
    );
  }

  if (preco?.encontrado && preco.precos && preco.precos.length > 0) {
    const linha = preco.precos[0]!;
    partes.push(
      `${cultura[0]!.toUpperCase()}${cultura.slice(1)} hoje em ${nomeDaUf(uf)}: ${brl(linha.preco)}${
        linha.unidade ? `/${linha.unidade}` : ""
      } (${linha.fonte}, ${dataBr(linha.data_referencia)}).`,
    );
  } else if (preco?.referencia_mercado) {
    partes.push(preco.referencia_mercado.frase);
  }

  if (progresso?.disponivel) {
    // Mesmo achado do card do painel: 0% é "ainda não começou", não dado
    // útil pra citar — cai pro nacional se o estado dele estiver zerado.
    const daUf = progresso.da_uf.find((l) => l.percentual > 0);
    const linha = daUf ?? progresso.nacional.find((l) => l.percentual > 0);
    if (linha) {
      const escopo = daUf ? "no seu estado" : "no Brasil (seu estado ainda não começou)";
      partes.push(
        `${pct(linha.percentual)} da safra já foi ${linha.tipo === "semeadura" ? "semeada" : "colhida"} ${escopo} (média de 5 anos: ${
          linha.media_5_anos != null ? pct(linha.media_5_anos) : "sem histórico"
        }), referência de ${mesAno(progresso.semana_referencia)}.`,
      );
    }
  }

  if (partes.length === 0) return null;
  return partes.join(" ");
}
