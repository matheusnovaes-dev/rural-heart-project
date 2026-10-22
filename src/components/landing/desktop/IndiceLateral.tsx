import { useEffect, useState } from "react";

/**
 * Índice lateral de capítulos (desktop largo com mouse; carregado dentro do DesktopFX, então o celular nunca baixa).
 * Uma linha fina com um ponto por seção: o capítulo atual mostra número e nome, os outros só o ponto, e o mouse
 * em cima abre todos os nomes. Aparece depois de passar do topo (o hero fica limpo) e usa `mix-blend-mode: difference`
 * para ler bem tanto no fundo creme quanto nos capítulos escuros. Os links são âncoras comuns (#id).
 */
const CAPITULOS: { id: string; nome: string }[] = [
  { id: "topo", nome: "Início" },
  { id: "problema", nome: "O problema" },
  { id: "no-whatsapp", nome: "No WhatsApp" },
  { id: "calculadora", nome: "Calculadora" },
  { id: "como-funciona", nome: "Como funciona" },
  { id: "painel", nome: "O painel" },
  { id: "planos", nome: "Planos" },
  { id: "duvidas", nome: "Dúvidas" },
  { id: "comece", nome: "Comece" },
];

export default function IndiceLateral() {
  const [existentes, setExistentes] = useState<typeof CAPITULOS>([]);
  const [ativo, setAtivo] = useState("topo");
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const achados = CAPITULOS.filter((c) => document.getElementById(c.id));
    setExistentes(achados);
    const io = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) if (e.isIntersecting) setAtivo(e.target.id);
      },
      // a faixa do meio da tela decide qual capítulo está "em foco"
      { rootMargin: "-45% 0px -50% 0px" },
    );
    achados.forEach((c) => io.observe(document.getElementById(c.id)!));
    const aoRolar = () => setVisivel(window.scrollY > window.innerHeight * 0.7);
    aoRolar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", aoRolar);
    };
  }, []);

  if (existentes.length === 0) return null;
  return (
    <nav
      aria-label="Capítulos da página"
      className="group fixed top-1/2 left-5 z-40 hidden -translate-y-1/2 text-white mix-blend-difference min-[1280px]:block"
      style={{
        opacity: visivel ? 1 : 0,
        pointerEvents: visivel ? "auto" : "none",
        transition: "opacity 0.5s",
      }}
    >
      <ol className="relative flex flex-col gap-4 pl-4">
        <span aria-hidden="true" className="absolute top-1 bottom-1 left-0 w-px bg-white/35" />
        {existentes.map((c, i) => {
          const atual = ativo === c.id;
          return (
            <li key={c.id} className="relative">
              <a
                href={`#${c.id}`}
                data-cursor="Ir"
                aria-current={atual ? "location" : undefined}
                className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] uppercase"
              >
                <span
                  aria-hidden="true"
                  className="absolute top-1/2 -left-4 block -translate-x-1/2 -translate-y-1/2 rounded-full bg-white transition-all duration-300"
                  style={{ width: atual ? 9 : 5, height: atual ? 9 : 5, opacity: atual ? 1 : 0.55 }}
                />
                <span className={atual ? "opacity-100" : "opacity-60"}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${
                    atual
                      ? "max-w-40 opacity-100"
                      : "max-w-0 opacity-0 group-hover:max-w-40 group-hover:opacity-80"
                  }`}
                >
                  {c.nome}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
