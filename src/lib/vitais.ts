/**
 * Métricas de desempenho de visitantes REAIS (Core Web Vitals), como fazem os times de ponta: as simulações em laboratório
 * dizem como o site DEVE se comportar, isto diz como ele SE COMPORTA no celular de quem está no campo, na rede dele.
 * Mede LCP, CLS, INP, FCP e TTFB com PerformanceObserver (sem biblioteca) e envia UMA vez, quando a página é escondida ou
 * fechada, por um fetch com keepalive direto na API REST do Supabase (não carrega o cliente de 52 KB).
 * Anônimo: sem IP, sem identificador, sem cookie; só a página (sem parâmetros), a métrica e o perfil do aparelho. Falha em
 * silêncio (tabela ainda não criada, sem rede, bloqueador): nunca atrapalha o site. Estrutura da tabela: supabase/vitais-web.sql.
 */
type Metrica = "LCP" | "CLS" | "INP" | "FCP" | "TTFB";

const URL_BASE = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const CHAVE = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function perfil() {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { effectiveType?: string };
    userAgentData?: { mobile?: boolean };
  };
  const ua = navigator.userAgent;
  const largura = window.innerWidth;
  const celular = nav.userAgentData?.mobile ?? /Android|iPhone|iPod|Mobile/i.test(ua);
  const tablet =
    !celular && /iPad|Tablet/i.test(ua)
      ? true
      : !celular && largura < 1024 && "ontouchstart" in window;
  const app = /Instagram/i.test(ua)
    ? "instagram"
    : /FBAN|FBAV|FB_IAB/i.test(ua)
      ? "facebook"
      : /WhatsApp/i.test(ua)
        ? "whatsapp"
        : null;
  const nav2 = /Edg\//.test(ua)
    ? "edge"
    : /OPR\//.test(ua)
      ? "opera"
      : /SamsungBrowser/i.test(ua)
        ? "samsung"
        : /Firefox\//.test(ua)
          ? "firefox"
          : /Chrome\//.test(ua)
            ? "chrome"
            : /Safari\//.test(ua)
              ? "safari"
              : "outro";
  const versao = ua.match(/(?:Chrome|Firefox|Version|Edg|OPR)\/(\d+)/)?.[1];
  return {
    aparelho: celular ? "celular" : tablet ? "tablet" : "desktop",
    memoria_gb: nav.deviceMemory ?? null,
    nucleos: navigator.hardwareConcurrency ?? null,
    rede: nav.connection?.effectiveType ?? null,
    navegador: nav2,
    versao: versao ? `${nav2} ${versao}` : null,
    app,
    nivel_fx: (document.documentElement.dataset["fxNivel"] as string | undefined) ?? null,
    largura,
  };
}

/** Rota sem parâmetros e sem ids (nada que identifique alguém): "/", "/login", "/dashboard/fazenda"... */
const pagina = () =>
  location.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, ":id").slice(0, 60) || "/";

export function iniciarVitais(): () => void {
  if (!URL_BASE || !CHAVE || !("PerformanceObserver" in window)) return () => {};
  // Só em produção de verdade (não em localhost nem no preview do editor)
  if (
    /^(localhost|127\.|\[::1\])/.test(location.hostname) ||
    /lovableproject|id-preview/.test(location.hostname)
  )
    return () => {};

  // A página medida é a da ENTRADA (o LCP e o TTFB são dela), mesmo que a pessoa navegue depois dentro do site.
  const paginaInicial = pagina();
  const v: Partial<Record<Metrica, number>> = {};
  // Sem nenhum deslocamento de layout o CLS é 0 (e não "sem medida"): só vale se o navegador mede layout-shift
  if (PerformanceObserver.supportedEntryTypes?.includes("layout-shift")) v.CLS = 0;
  const obs: PerformanceObserver[] = [];
  const observar = (tipo: string, fn: (e: PerformanceEntry) => void, extra: object = {}) => {
    try {
      const o = new PerformanceObserver((l) => l.getEntries().forEach(fn));
      o.observe({ type: tipo, buffered: true, ...extra } as PerformanceObserverInit);
      obs.push(o);
    } catch {
      // navegador sem esse tipo de métrica: só não mede
    }
  };

  const nav = performance.getEntriesByType("navigation")[0] as
    PerformanceNavigationTiming | undefined;
  if (nav && nav.responseStart > 0) v.TTFB = nav.responseStart;
  observar("paint", (e) => {
    if (e.name === "first-contentful-paint") v.FCP = e.startTime;
  });
  observar("largest-contentful-paint", (e) => {
    v.LCP = e.startTime;
  });
  // CLS: janelas de sessão (máx. 5 s, pausa de 1 s), vale a pior janela, como no web-vitals
  let janela = 0;
  let ini = 0;
  let fim = 0;
  let pior = 0;
  observar("layout-shift", (e) => {
    const l = e as PerformanceEntry & { value: number; hadRecentInput: boolean };
    if (l.hadRecentInput) return;
    if (!ini || l.startTime - fim > 1000 || l.startTime - ini > 5000) {
      janela = 0;
      ini = l.startTime;
    }
    janela += l.value;
    fim = l.startTime;
    pior = Math.max(pior, janela);
    v.CLS = pior;
  });
  // INP: a pior interação (aproximação com o 98º percentil das interações; com poucas, a maior)
  const duracoes: number[] = [];
  observar(
    "event",
    (e) => {
      const ev = e as PerformanceEntry & { interactionId?: number };
      if (!ev.interactionId) return;
      duracoes.push(e.duration);
      const ordenadas = [...duracoes].sort((a, b) => b - a);
      v.INP =
        ordenadas[Math.min(ordenadas.length - 1, Math.floor(duracoes.length / 50))] ?? e.duration;
    },
    { durationThreshold: 40 },
  );

  let enviado = false;
  const enviar = () => {
    if (enviado || document.visibilityState !== "hidden") return;
    const metricas = (Object.entries(v) as [Metrica, number][]).filter(([, x]) =>
      Number.isFinite(x),
    );
    if (!metricas.length) return;
    enviado = true;
    const base = { pagina: paginaInicial, ...perfil() };
    const linhas = metricas.map(([metrica, valor]) => ({
      ...base,
      metrica,
      valor: metrica === "CLS" ? Math.round(valor * 1000) / 1000 : Math.round(valor),
    }));
    try {
      void fetch(`${URL_BASE}/rest/v1/vitais_web`, {
        method: "POST",
        keepalive: true,
        headers: {
          apikey: CHAVE,
          Authorization: `Bearer ${CHAVE}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(linhas),
      }).catch(() => {});
    } catch {
      // sem rede ou bloqueado: tudo bem
    }
  };
  addEventListener("visibilitychange", enviar);
  addEventListener("pagehide", enviar);
  return () => {
    removeEventListener("visibilitychange", enviar);
    removeEventListener("pagehide", enviar);
    obs.forEach((o) => o.disconnect());
  };
}
