import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// Landing ("/"): os ~55 <link rel="modulepreload"> do HTML disputavam banda com a foto do hero (que é o LCP) e a foto, de
// 28KB, só chegava depois dos ~340KB de JS. Marcados como prioridade baixa, a foto vai primeiro e os scripts chegam logo
// em seguida (a página já está desenhada: o JS só serve para a hidratação). Streaming com HTMLRewriter (Cloudflare e Bun);
// se não existir ou falhar, a resposta segue intocada.
const APLICAR_PRIORIDADE_BAIXA = true;

function baixarPrioridadeDosScripts(request: Request, response: Response): Response {
  try {
    const rewriter = (globalThis as unknown as { HTMLRewriter?: new () => unknown }).HTMLRewriter;
    if (!rewriter || response.status !== 200) return response;
    if (new URL(request.url).pathname !== "/") return response;
    if (!(response.headers.get("content-type") ?? "").includes("text/html")) return response;
    const r = new rewriter() as {
      on: (
        seletor: string,
        h: { element: (e: { setAttribute: (k: string, v: string) => void }) => void },
      ) => { transform: (r: Response) => Response };
    };
    return r
      .on('link[rel="modulepreload"]', { element: (e) => e.setAttribute("fetchpriority", "low") })
      .transform(response);
  } catch {
    return response;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalizada = await normalizeCatastrophicSsrResponse(response);
      // 2026-10-21: testado em Moto G4 emulado (CPU 4x, 1,6 Mbps): com prioridade baixa o primeiro conteúdo aparece em ~2,2 s
      // contra 2,5 a 3,0 s sem ela, e o campo hidrata no mesmo tempo. Por isso voltou; o experimento de conversão segue só
      // com o formulário sem carregamento sob demanda (LeadFormCarregavel).
      return APLICAR_PRIORIDADE_BAIXA
        ? baixarPrioridadeDosScripts(request, normalizada)
        : normalizada;
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
