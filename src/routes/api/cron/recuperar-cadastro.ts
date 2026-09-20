import { createFileRoute } from "@tanstack/react-router";

import { normalizarWhatsapp } from "@/lib/telefone";
import { supabaseServiceRole } from "@/lib/supabase.server";
import {
  celularValidoParaEnvio,
  dentroDoHorarioDeEnvio,
  envioConfirmado,
  HORAS_MAXIMAS_PARA_ENVIAR,
  MAX_ENVIOS_POR_RODADA,
  MINUTOS_ANTES_DE_ENVIAR,
  urlDoWebhookDeRecuperacao,
} from "@/lib/recuperacaoCadastro";

type Iniciado = { id: string; whatsapp: string; created_at: string };

type Resultado = {
  enviados: number;
  falhas: number;
  ignorados: number;
};

/**
 * Manda uma mensagem de WhatsApp (template aprovado pela Meta) pra quem deixou o
 * número na etapa 1 do formulário e não terminou o cadastro. Chamado por um cron
 * externo (GitHub Actions do conab-ingestor, a cada 30 min), autenticado por
 * segredo compartilhado, igual ao aviso de trial.
 *
 * Travas, todas por código: automação desligada por padrão (automacoes_config),
 * só em horário comercial, uma única mensagem por número, nunca pra quem já se
 * cadastrou, já falou com o bot ou pediu pra sair, e nunca pra número inválido.
 * `?simular=1` mostra o que enviaria sem enviar nem gravar nada.
 */
export const Route = createFileRoute("/api/cron/recuperar-cadastro")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cronSecret = process.env["CRON_SECRET"];
        const urlBoasVindas = process.env["N8N_BOAS_VINDAS_WEBHOOK_URL"];
        const tokenN8n = process.env["N8N_BOAS_VINDAS_TOKEN"];
        if (!cronSecret || !urlBoasVindas || !tokenN8n) {
          return new Response("Missing server configuration", { status: 500 });
        }
        if (request.headers.get("x-cron-secret") !== cronSecret) {
          return new Response("Token inválido", { status: 401 });
        }
        const urlEnvio = urlDoWebhookDeRecuperacao(urlBoasVindas);
        if (!urlEnvio) return new Response("URL do webhook inesperada", { status: 500 });

        const simular = new URL(request.url).searchParams.get("simular") === "1";
        const supabase = supabaseServiceRole();

        const { data: config } = await supabase
          .from("automacoes_config")
          .select("ativa")
          .eq("chave", "recuperacao_cadastro")
          .maybeSingle();
        if (!config?.ativa && !simular) return Response.json({ ativa: false });
        if (!dentroDoHorarioDeEnvio(new Date()) && !simular) {
          return Response.json({ ativa: true, fora_do_horario: true });
        }

        const agora = Date.now();
        const { data: candidatos } = await supabase
          .from("cadastro_iniciados")
          .select("id, whatsapp, created_at")
          .is("recuperacao_status", null)
          .lte("created_at", new Date(agora - MINUTOS_ANTES_DE_ENVIAR * 60_000).toISOString())
          .gte("created_at", new Date(agora - HORAS_MAXIMAS_PARA_ENVIAR * 3_600_000).toISOString())
          .order("created_at", { ascending: true })
          .limit(MAX_ENVIOS_POR_RODADA)
          .returns<Iniciado[]>();

        const numeros = [...new Set((candidatos ?? []).map((c) => normalizarWhatsapp(c.whatsapp)))];
        const comDdi = numeros.map((n) => `55${n}`);
        const [cadastrados, conversaram, saiu, jaEnviados] = await Promise.all([
          supabase.from("produtores").select("whatsapp").in("whatsapp", numeros),
          supabase
            .from("bot_conversas")
            .select("telefone")
            .in("telefone", [...numeros, ...comDdi]),
          supabase.from("whatsapp_optout").select("whatsapp").in("whatsapp", numeros),
          supabase
            .from("cadastro_iniciados")
            .select("whatsapp")
            .eq("recuperacao_status", "enviado")
            .in("whatsapp", numeros),
        ]);
        const setDe = (linhas: { [k: string]: string }[] | null, campo: string) =>
          new Set((linhas ?? []).map((l) => normalizarWhatsapp(l[campo] ?? "")));
        const jaCadastrados = setDe(cadastrados.data, "whatsapp");
        const jaConversaram = setDe(conversaram.data, "telefone");
        const optout = setDe(saiu.data, "whatsapp");
        const jaRecebeu = setDe(jaEnviados.data, "whatsapp");

        const resultado: Resultado = { enviados: 0, falhas: 0, ignorados: 0 };
        const previa: { whatsapp: string; acao: string }[] = [];
        const marcar = async (id: string, status: string) => {
          if (simular) return;
          await supabase
            .from("cadastro_iniciados")
            .update({
              recuperacao_status: status,
              recuperacao_enviada_em: new Date().toISOString(),
            })
            .eq("id", id);
        };

        for (const c of candidatos ?? []) {
          const numero = normalizarWhatsapp(c.whatsapp);
          let ignorar: string | null = null;
          if (!celularValidoParaEnvio(numero)) ignorar = "ignorado_invalido";
          else if (jaCadastrados.has(numero)) ignorar = "ignorado_ja_cadastrado";
          else if (jaConversaram.has(numero)) ignorar = "ignorado_ja_conversou";
          else if (optout.has(numero)) ignorar = "ignorado_optout";
          else if (jaRecebeu.has(numero)) ignorar = "ignorado_duplicado";
          if (ignorar) {
            resultado.ignorados++;
            previa.push({ whatsapp: `***${numero.slice(-4)}`, acao: ignorar });
            await marcar(c.id, ignorar);
            continue;
          }
          if (simular) {
            previa.push({ whatsapp: `***${numero.slice(-4)}`, acao: "enviaria" });
            jaRecebeu.add(numero);
            continue;
          }
          try {
            const res = await fetch(urlEnvio, {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-safralume-token": tokenN8n },
              body: JSON.stringify({ telefone: `55${numero}` }),
            });
            const ok = envioConfirmado(res.status, await res.text());
            await marcar(c.id, ok ? "enviado" : "falhou");
            if (ok) resultado.enviados++;
            else resultado.falhas++;
          } catch (err) {
            console.error("Falha ao pedir o envio da recuperação de cadastro:", err);
            await marcar(c.id, "falhou");
            resultado.falhas++;
          }
          // Uma tentativa por número por rodada, deu certo ou não: a segunda
          // linha do mesmo número não pode disparar outro envio.
          jaRecebeu.add(numero);
        }

        return Response.json({ ativa: !!config?.ativa, simular, ...resultado, previa });
      },
    },
  },
});
