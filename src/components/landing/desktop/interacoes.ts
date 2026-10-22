import Lenis from "lenis";

/**
 * Interações de desktop da landing, todas num único laço de animação compartilhado: cursor próprio, botões
 * magnéticos, cartões que inclinam e brilham com o mouse, parallax de imagens e scroll com inércia (Lenis).
 * Nada aqui toca o layout: só transform e variáveis CSS. Cada função devolve a sua limpeza.
 */

type Tarefa = (agora: number) => void;
const tarefas = new Set<Tarefa>();
let raf = 0;
function laco(agora: number) {
  tarefas.forEach((t) => t(agora));
  raf = requestAnimationFrame(laco);
}
function registrar(t: Tarefa): () => void {
  tarefas.add(t);
  if (!raf) raf = requestAnimationFrame(laco);
  return () => {
    tarefas.delete(t);
    if (!tarefas.size && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };
}

const lerp = (a: number, b: number, k: number) => a + (a === b ? 0 : (b - a) * k);

// ---------------------------------------------------------------- scroll suave
export function iniciarScrollSuave(): () => void {
  const lenis = new Lenis({ lerp: 0.09, smoothWheel: true, anchors: true });
  const parar = registrar((agora) => lenis.raf(agora));
  // Diálogos (cadastro) travam o scroll da página: o Lenis precisa parar junto, senão rola por trás.
  const travado = () =>
    document.body.hasAttribute("data-scroll-locked") || document.body.style.overflow === "hidden";
  const sincronizar = () => (travado() ? lenis.stop() : lenis.start());
  const mo = new MutationObserver(sincronizar);
  mo.observe(document.body, { attributes: true, attributeFilter: ["data-scroll-locked", "style"] });
  sincronizar();
  return () => {
    mo.disconnect();
    parar();
    lenis.destroy();
  };
}

// --------------------------------------------------------------------- cursor
const ALVOS_CLICAVEIS = "a,button,[role=button],summary,label,select,[data-cursor]";
const CAMPOS_DE_TEXTO = "input,textarea,[contenteditable=true]";

export function iniciarCursor(): () => void {
  const estilo = document.createElement("style");
  estilo.dataset["fx"] = "cursor";
  estilo.textContent = `html.fx-cursor, html.fx-cursor * { cursor: none !important; }
html.fx-cursor ${CAMPOS_DE_TEXTO.replace(/,/g, ", html.fx-cursor ")} { cursor: text !important; }`;
  document.head.appendChild(estilo);

  const caixa = (css: string) => {
    const d = document.createElement("div");
    d.setAttribute("aria-hidden", "true");
    d.dataset["fx"] = "cursor";
    d.style.cssText = `position:fixed;left:0;top:0;pointer-events:none;z-index:2147483000;will-change:transform;opacity:0;transition:opacity .25s;${css}`;
    document.body.appendChild(d);
    return d;
  };
  const aro = caixa("width:0;height:0;");
  const miolo = document.createElement("div");
  // Contorno duplo (branco com filete escuro dos dois lados) em vez de mix-blend: continua visível sobre
  // foto escura, fundo creme, verde e laranja. O miolo vira laranja translúcido sobre o que é clicável.
  miolo.style.cssText =
    "position:absolute;left:-19px;top:-19px;width:38px;height:38px;border-radius:9999px;border:2px solid #fff;box-shadow:0 0 0 1.5px rgba(10,24,16,.7),inset 0 0 0 1.5px rgba(10,24,16,.7),0 2px 10px rgba(0,0,0,.25);transition:transform .3s cubic-bezier(.22,1,.36,1),background-color .3s;";
  aro.appendChild(miolo);
  // Rótulo do cursor (como no site do Lando Norris: "Ver" sobre o vídeo): fica fora do círculo que escala, para o texto
  // não crescer junto.
  const rotuloEl = document.createElement("div");
  rotuloEl.style.cssText =
    "position:absolute;left:-60px;top:-12px;width:120px;text-align:center;font:700 15px/24px 'IBM Plex Sans',sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#0e3b2a;opacity:0;transition:opacity .2s;";
  aro.appendChild(rotuloEl);
  const ponto = caixa("width:0;height:0;");
  const bolinha = document.createElement("div");
  bolinha.style.cssText =
    "position:absolute;left:-5px;top:-5px;width:10px;height:10px;border-radius:9999px;background:#e8912a;border:2px solid #fff;box-shadow:0 0 0 1.5px rgba(10,24,16,.7);";
  ponto.appendChild(bolinha);

  let alvoX = -100;
  let alvoY = -100;
  let ax = -100;
  let ay = -100;
  let px = -100;
  let py = -100;
  let visivel = false;
  let escala = 1;
  let apertado = false;
  const aplicarEscala = () => {
    miolo.style.transform = `scale(${apertado ? escala * 0.8 : escala})`;
  };

  const aoMover = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    alvoX = e.clientX;
    alvoY = e.clientY;
    if (!visivel) {
      ax = px = alvoX;
      ay = py = alvoY;
      visivel = true;
      document.documentElement.classList.add("fx-cursor");
      aro.style.opacity = ponto.style.opacity = "1";
    }
  };
  const aoSobrepor = (e: PointerEvent) => {
    const t = e.target as Element | null;
    if (!t || !t.closest) return;
    const campo = !!t.closest(CAMPOS_DE_TEXTO);
    const clicavel = !!t.closest(ALVOS_CLICAVEIS);
    const rotulo = (t.closest("[data-cursor]") as HTMLElement | null)?.dataset["cursor"] ?? "";
    aro.style.opacity = ponto.style.opacity = campo ? "0" : "1";
    escala = rotulo ? 2.5 : clicavel ? 1.4 : 1;
    miolo.style.backgroundColor = rotulo
      ? "rgba(232,145,42,.96)"
      : clicavel
        ? "rgba(232,145,42,.3)"
        : "transparent";
    rotuloEl.textContent = rotulo;
    rotuloEl.style.opacity = rotulo ? "1" : "0";
    bolinha.style.opacity = rotulo ? "0" : "1";
    aplicarEscala();
  };
  const aoApertar = (v: boolean) => () => {
    apertado = v;
    aplicarEscala();
  };
  const apertar = aoApertar(true);
  const soltar = aoApertar(false);
  const aoSair = () => {
    visivel = false;
    document.documentElement.classList.remove("fx-cursor");
    aro.style.opacity = ponto.style.opacity = "0";
  };

  window.addEventListener("pointermove", aoMover, { passive: true });
  window.addEventListener("pointerover", aoSobrepor, { passive: true });
  window.addEventListener("pointerdown", apertar, { passive: true });
  window.addEventListener("pointerup", soltar, { passive: true });
  document.documentElement.addEventListener("pointerleave", aoSair);
  const parar = registrar(() => {
    ax = lerp(ax, alvoX, 0.18);
    ay = lerp(ay, alvoY, 0.18);
    px = lerp(px, alvoX, 0.65);
    py = lerp(py, alvoY, 0.65);
    aro.style.transform = `translate3d(${ax}px,${ay}px,0)`;
    ponto.style.transform = `translate3d(${px}px,${py}px,0)`;
  });

  return () => {
    parar();
    window.removeEventListener("pointermove", aoMover);
    window.removeEventListener("pointerover", aoSobrepor);
    window.removeEventListener("pointerdown", apertar);
    window.removeEventListener("pointerup", soltar);
    document.documentElement.removeEventListener("pointerleave", aoSair);
    document.documentElement.classList.remove("fx-cursor");
    aro.remove();
    ponto.remove();
    estilo.remove();
  };
}

// ----------------------------------------------------------------- magnéticos
export function iniciarMagneticos(): () => void {
  type Estado = { x: number; y: number; alvoX: number; alvoY: number };
  const estados = new Map<HTMLElement, Estado>();
  let mx = -9999;
  let my = -9999;
  const aoMover = (e: PointerEvent) => {
    mx = e.clientX;
    my = e.clientY;
  };
  window.addEventListener("pointermove", aoMover, { passive: true });
  let ultimaBusca = 0;
  const parar = registrar((agora) => {
    if (agora - ultimaBusca > 1000) {
      ultimaBusca = agora;
      document.querySelectorAll<HTMLElement>("[data-magnetico]").forEach((el) => {
        if (!estados.has(el)) estados.set(el, { x: 0, y: 0, alvoX: 0, alvoY: 0 });
      });
    }
    estados.forEach((s, el) => {
      if (!el.isConnected) {
        estados.delete(el);
        return;
      }
      const r = el.getBoundingClientRect();
      const dx = mx - (r.left + r.width / 2);
      const dy = my - (r.top + r.height / 2);
      const raio = Math.max(r.width, r.height) * 0.6 + 30;
      if (Math.hypot(dx, dy) < raio) {
        // puxa de leve na direção do mouse, com teto: o botão nunca invade o que está ao lado
        s.alvoX = Math.max(-9, Math.min(9, dx * 0.16));
        s.alvoY = Math.max(-7, Math.min(7, dy * 0.16));
      } else {
        s.alvoX = 0;
        s.alvoY = 0;
      }
      if (
        Math.abs(s.x - s.alvoX) < 0.05 &&
        Math.abs(s.y - s.alvoY) < 0.05 &&
        !s.alvoX &&
        !s.alvoY
      ) {
        if (s.x || s.y) {
          s.x = s.y = 0;
          el.style.transform = "";
        }
        return;
      }
      s.x = lerp(s.x, s.alvoX, 0.16);
      s.y = lerp(s.y, s.alvoY, 0.16);
      el.style.transform = `translate3d(${s.x.toFixed(2)}px,${s.y.toFixed(2)}px,0)`;
    });
  });
  return () => {
    window.removeEventListener("pointermove", aoMover);
    parar();
    estados.forEach((_, el) => (el.style.transform = ""));
  };
}

// ------------------------------------------------- cartões: inclinação e brilho
export function iniciarCartoes(): () => void {
  type Estado = { rx: number; ry: number; alvoRx: number; alvoRy: number };
  const estados = new Map<HTMLElement, Estado>();
  let atual: HTMLElement | null = null;
  let mx = 0;
  let my = 0;

  const aoMover = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    mx = e.clientX;
    my = e.clientY;
    const el =
      (e.target as Element | null)?.closest?.<HTMLElement>("[data-tilt],[data-spotlight]") ?? null;
    atual = el;
    if (el) {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${((mx - r.left) / r.width) * 100}%`);
      el.style.setProperty("--my", `${((my - r.top) / r.height) * 100}%`);
      if (el.hasAttribute("data-tilt") && !estados.has(el)) {
        estados.set(el, { rx: 0, ry: 0, alvoRx: 0, alvoRy: 0 });
      }
    }
  };
  window.addEventListener("pointermove", aoMover, { passive: true });

  const parar = registrar(() => {
    estados.forEach((s, el) => {
      if (el === atual) {
        const r = el.getBoundingClientRect();
        s.alvoRy = ((mx - r.left) / r.width - 0.5) * 9;
        s.alvoRx = -((my - r.top) / r.height - 0.5) * 7;
      } else {
        s.alvoRx = 0;
        s.alvoRy = 0;
      }
      s.rx = lerp(s.rx, s.alvoRx, 0.12);
      s.ry = lerp(s.ry, s.alvoRy, 0.12);
      if (Math.abs(s.rx) < 0.01 && Math.abs(s.ry) < 0.01 && el !== atual) {
        el.style.transform = "";
        estados.delete(el);
        return;
      }
      el.style.transform = `perspective(1000px) rotateX(${s.rx.toFixed(2)}deg) rotateY(${s.ry.toFixed(2)}deg)`;
    });
  });
  return () => {
    window.removeEventListener("pointermove", aoMover);
    parar();
    estados.forEach((_, el) => (el.style.transform = ""));
  };
}

// ------------------------------------------------------------------- parallax
export function iniciarParallax(): () => void {
  const els = Array.from(document.querySelectorAll<HTMLElement>("[data-parallax]"));
  if (!els.length) return () => {};
  const visiveis = new Set<HTMLElement>();
  const io = new IntersectionObserver(
    (entradas) =>
      entradas.forEach((e) => {
        const el = e.target as HTMLElement;
        if (e.isIntersecting) visiveis.add(el);
        else visiveis.delete(el);
      }),
    { rootMargin: "100px" },
  );
  els.forEach((el) => {
    el.style.willChange = "transform";
    io.observe(el);
  });
  const parar = registrar(() => {
    const vh = window.innerHeight;
    visiveis.forEach((el) => {
      const pai = el.parentElement ?? el;
      const r = pai.getBoundingClientRect();
      const centro = r.top + r.height / 2 - vh / 2;
      const y = Math.max(-1, Math.min(1, centro / vh)) * -34;
      el.style.transform = `translate3d(0,${y.toFixed(1)}px,0) scale(1.14)`;
    });
  });
  return () => {
    parar();
    io.disconnect();
    els.forEach((el) => {
      el.style.transform = "";
      el.style.willChange = "";
    });
  };
}

// -------------------------------------------------------------------- cortinas
/**
 * Seções marcadas com data-cortina "abrem" ao entrar na tela: começam recortadas e arredondadas nas
 * laterais e se alargam até ocupar tudo (clip-path, sem mexer no layout), como uma cortina subindo.
 */
export function iniciarCortinas(): () => void {
  const els = Array.from(document.querySelectorAll<HTMLElement>("[data-cortina]"));
  if (!els.length) return () => {};
  const visiveis = new Set<HTMLElement>();
  const io = new IntersectionObserver(
    (entradas) =>
      entradas.forEach((e) => {
        const el = e.target as HTMLElement;
        if (e.isIntersecting) visiveis.add(el);
        else visiveis.delete(el);
      }),
    { rootMargin: "50px" },
  );
  els.forEach((el) => io.observe(el));
  const parar = registrar(() => {
    const vh = window.innerHeight;
    visiveis.forEach((el) => {
      const topo = el.getBoundingClientRect().top;
      const p = Math.max(0, Math.min(1, (vh - topo) / (vh * 0.65)));
      const e = 1 - (1 - p) * (1 - p);
      el.style.clipPath =
        e >= 0.999
          ? ""
          : `inset(0 ${((1 - e) * 7).toFixed(2)}% round ${((1 - e) * 56).toFixed(1)}px)`;
    });
  });
  return () => {
    parar();
    io.disconnect();
    els.forEach((el) => (el.style.clipPath = ""));
  };
}

// ----------------------------------------------------------------- profundidade
/**
 * Elementos com data-profundidade="N" se deslocam em sentido oposto ao do mouse (até N px), cada um com a sua
 * intensidade: o título e o subtítulo do hero parecem em camadas. Usa a propriedade CSS `translate` (independente de
 * `transform`), então não briga com as animações do framer-motion. Só desktop.
 */
export function iniciarProfundidade(): () => void {
  const els = Array.from(document.querySelectorAll<HTMLElement>("[data-profundidade]"));
  if (!els.length) return () => {};
  let alvoX = 0;
  let alvoY = 0;
  let x = 0;
  let y = 0;
  const aoMover = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    alvoX = (e.clientX / window.innerWidth - 0.5) * 2;
    alvoY = (e.clientY / window.innerHeight - 0.5) * 2;
  };
  window.addEventListener("pointermove", aoMover, { passive: true });
  const parar = registrar(() => {
    x = lerp(x, alvoX, 0.07);
    y = lerp(y, alvoY, 0.07);
    // só trabalha enquanto o hero está na tela
    if (window.scrollY > window.innerHeight * 1.1) return;
    els.forEach((el) => {
      const n = Number(el.dataset["profundidade"]) || 0;
      el.style.translate = `${(-x * n).toFixed(2)}px ${(-y * n * 0.7).toFixed(2)}px`;
    });
  });
  return () => {
    window.removeEventListener("pointermove", aoMover);
    parar();
    els.forEach((el) => (el.style.translate = ""));
  };
}

// -------------------------------------------------------------------- palcos 3D
/**
 * Câmera 3D guiada pelo scroll nos elementos que já existem (não são objetos decorativos): `data-palco3d="celular"`
 * entra girado e vai assentando, `"painel"` chega deitado em perspectiva e "pousa" na tela enquanto as camadas marcadas
 * com `data-camada="N"` descolam e voltam ao lugar, e `"plano-esq" | "plano-meio" | "plano-dir"` chegam em leque, de
 * trás do cartão do meio. Depois de pousados, o painel e os planos seguem o mouse de leve. Só transform e a
 * propriedade `translate`, tudo no mesmo laço; nada roda fora da tela.
 */
export function iniciarPalcos3D(): () => void {
  const els = Array.from(document.querySelectorAll<HTMLElement>("[data-palco3d]"));
  if (!els.length) return () => {};
  type Estado = { e: number; mx: number; my: number; alvoMx: number; alvoMy: number };
  const estados = new Map<HTMLElement, Estado>();
  const visiveis = new Set<HTMLElement>();
  const io = new IntersectionObserver(
    (entradas) =>
      entradas.forEach((en) => {
        const el = en.target as HTMLElement;
        if (en.isIntersecting) visiveis.add(el);
        else visiveis.delete(el);
      }),
    { rootMargin: "200px 0px" },
  );
  els.forEach((el) => {
    estados.set(el, { e: 0, mx: 0, my: 0, alvoMx: 0, alvoMy: 0 });
    el.style.willChange = "transform";
    el.style.transformOrigin = el.dataset["palco3d"] === "painel" ? "50% 0%" : "50% 50%";
    io.observe(el);
  });
  const aoMover = (ev: PointerEvent) => {
    if (ev.pointerType !== "mouse") return;
    visiveis.forEach((el) => {
      const s = estados.get(el)!;
      const r = el.getBoundingClientRect();
      const dentro =
        ev.clientX >= r.left &&
        ev.clientX <= r.right &&
        ev.clientY >= r.top &&
        ev.clientY <= r.bottom;
      s.alvoMx = dentro ? (ev.clientX - r.left) / r.width - 0.5 : 0;
      s.alvoMy = dentro ? (ev.clientY - r.top) / r.height - 0.5 : 0;
    });
  };
  window.addEventListener("pointermove", aoMover, { passive: true });

  const parar = registrar(() => {
    const vh = window.innerHeight;
    visiveis.forEach((el) => {
      const s = estados.get(el)!;
      const r = el.getBoundingClientRect();
      const tipo = el.dataset["palco3d"];
      // entrada: 0 quando o topo encosta no pé da tela, 1 quando chega a ~15% do topo (curva suave nas duas pontas,
      // para o movimento ser visível durante toda a entrada e não só no primeiro instante)
      const p = Math.max(0, Math.min(1, (vh - r.top) / (vh * 0.85)));
      const alvoE = p * p * (3 - 2 * p);
      s.e = lerp(s.e, alvoE, 0.16);
      s.mx = lerp(s.mx, s.alvoMx, 0.08);
      s.my = lerp(s.my, s.alvoMy, 0.08);
      const f = 1 - s.e; // quanto falta para pousar
      // órbita: o quanto o centro do elemento está acima/abaixo do meio da tela (-1..1)
      const o = Math.max(-1, Math.min(1, (r.top + r.height / 2 - vh / 2) / vh));
      let t = "";
      if (tipo === "celular") {
        t = `perspective(1200px) translate3d(${(-f * 12).toFixed(2)}%,${(f * 140).toFixed(1)}px,${(-f * 260).toFixed(1)}px) rotateX(${(f * 24 - o * 5).toFixed(2)}deg) rotateY(${(-f * 62 + o * 12).toFixed(2)}deg) rotateZ(${(-f * 9).toFixed(2)}deg)`;
      } else if (tipo === "painel") {
        t = `perspective(1600px) translate3d(0,${(f * 220).toFixed(1)}px,${(-f * 380).toFixed(1)}px) rotateX(${(f * 58 - s.my * 5).toFixed(2)}deg) rotateY(${(-f * 14 + s.mx * 7).toFixed(2)}deg) rotateZ(${(f * 3).toFixed(2)}deg)`;
        // reflexo de luz que atravessa o vidro do painel enquanto ele pousa
        el.style.setProperty("--brilho", f.toFixed(3));
        el.querySelectorAll<HTMLElement>("[data-camada]").forEach((c) => {
          const n = Number(c.dataset["camada"]) || 0;
          c.style.translate = `${(s.mx * n * 0.6).toFixed(2)}px ${(-f * n * 4 + s.my * n * 0.5).toFixed(2)}px`;
        });
      } else if (tipo?.startsWith("plano-")) {
        const lado = tipo === "plano-esq" ? 1 : tipo === "plano-dir" ? -1 : 0;
        const tx = lado * f * 96; // em %: começa empilhado atrás do cartão do meio
        const tz = -f * (lado ? 520 : 220);
        const ry = lado * f * 52 + s.mx * 8;
        const rx = (lado ? f * 10 : f * 38) - s.my * 6;
        const rz = lado * f * -6;
        t = `perspective(1400px) translate3d(${tx.toFixed(2)}%,${(f * 120).toFixed(1)}px,${tz.toFixed(1)}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg)`;
      }
      el.style.transform = t;
    });
  });
  return () => {
    window.removeEventListener("pointermove", aoMover);
    parar();
    io.disconnect();
    els.forEach((el) => {
      el.style.transform = "";
      el.style.willChange = "";
      el.querySelectorAll<HTMLElement>("[data-camada]").forEach((c) => (c.style.translate = ""));
    });
  };
}
