import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseServiceRole } from "@/lib/supabase.server";
import { calcularValorProducao } from "@/lib/calculadora";

const calcularSchema = z.object({
  cultura: z.string().min(1),
  uf: z.string().length(2),
  sacas: z.number().positive().max(10_000_000),
  ufReferencia: z.string().length(2).nullable().optional(),
});

/**
 * Versão pública (sem login) da Calculadora de Safra, pra landing page. Roda
 * com service role porque `precos` só é legível por usuário autenticado
 * (RLS) — o visitante ainda não tem conta. Só devolve o resultado calculado
 * pra UMA combinação de cultura/UF/sacas por chamada, nunca linhas cruas da
 * tabela: não dá pra usar isso pra raspar o banco inteiro de fora.
 *
 * Sem custo de produção de propósito (fase 1 da landing): pedir o custo pra
 * quem ainda nem se cadastrou é um pedido grande demais pra esse ponto da
 * jornada — a landing só mostra o valor bruto real; margem fica pro painel,
 * depois que a pessoa já confia no produto.
 */
export const calcularValorProducaoPublico = createServerFn({ method: "POST" })
  .validator(calcularSchema)
  .handler(async ({ data }) => {
    const supabase = supabaseServiceRole();
    return calcularValorProducao(supabase, {
      cultura: data.cultura,
      uf: data.uf,
      sacas: data.sacas,
      custoSaca: null,
      ufReferencia: data.ufReferencia ?? null,
    });
  });
