import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CHAVE_LOCALSTORAGE = "safralume_tour_visto";

// Passos possíveis do tour, na ordem em que devem aparecer — o tour filtra
// pra só os que realmente existem na tela (produtor e cooperativa têm
// menus diferentes, e nem todo produtor tem assinatura própria).
const PASSOS = [
  {
    rota: "/dashboard",
    titulo: "Comece por aqui",
    descricao: "Um resumo rápido do que importa hoje, assim que você entra.",
  },
  {
    rota: "/dashboard/precos",
    titulo: "Preços",
    descricao: "Cotação por estado, direto da Conab, sempre atualizada. Escolha a cultura no topo.",
  },
  {
    rota: "/dashboard/alertas",
    titulo: "Alertas",
    descricao:
      "Avisa sozinho no seu WhatsApp quando o preço cruzar um valor ou o clima mudar de verdade. Você não precisa ficar checando.",
  },
  {
    rota: "/dashboard/lembretes",
    titulo: "Lembretes",
    descricao:
      "Agenda tarefas do dia a dia pra chegar no WhatsApp na hora certa — pra você ou pra sua equipe.",
  },
  {
    rota: "/dashboard/funcionarios",
    titulo: "Funcionários",
    descricao:
      "Cadastre quem trabalha com você (só nome e WhatsApp) e mande lembretes direto pra pessoa certa.",
  },
  {
    rota: "/dashboard/produtores",
    titulo: "Produtores",
    descricao: "Veja e gerencie os produtores associados à sua cooperativa.",
  },
  {
    rota: "/dashboard/clima",
    titulo: "Clima",
    descricao: "Previsão pra sua região, direto no painel.",
  },
  {
    rota: "/dashboard/equipe",
    titulo: "Equipe",
    descricao: "Adicione outras pessoas da cooperativa que também usam o painel.",
  },
  {
    rota: "/dashboard/assinatura",
    titulo: "Assinatura",
    descricao: "Veja seu plano atual e mude quando quiser.",
  },
] as const;

type Retangulo = { top: number; left: number; width: number; height: number };

export function DashboardTour() {
  const [ativo, setAtivo] = useState(false);
  const [passoIndex, setPassoIndex] = useState(0);
  const [passosDisponiveis, setPassosDisponiveis] = useState<(typeof PASSOS)[number][]>([]);
  const [retangulo, setRetangulo] = useState<Retangulo | null>(null);

  // só decide mostrar (e calcula quais passos existem de fato na tela)
  // depois que a navegação real já renderizou — senão os data-tour ainda
  // não existem no DOM.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let jaVisto = false;
    try {
      jaVisto = window.localStorage.getItem(CHAVE_LOCALSTORAGE) === "true";
    } catch {
      jaVisto = false;
    }
    if (jaVisto) return;

    const id = window.setTimeout(() => {
      const disponiveis = PASSOS.filter((p) => document.querySelector(`[data-tour="${p.rota}"]`));
      if (disponiveis.length === 0) return;
      setPassosDisponiveis(disponiveis);
      setAtivo(true);
    }, 400);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!ativo || passosDisponiveis.length === 0) return;

    function medir() {
      const passo = passosDisponiveis[passoIndex];
      if (!passo) return;
      const alvo = document.querySelector(`[data-tour="${passo.rota}"]`);
      if (!alvo) return;
      const r = alvo.getBoundingClientRect();
      setRetangulo({ top: r.top, left: r.left, width: r.width, height: r.height });
      alvo.scrollIntoView({ block: "nearest", inline: "nearest" });
    }

    medir();
    window.addEventListener("resize", medir);
    window.addEventListener("scroll", medir, true);
    return () => {
      window.removeEventListener("resize", medir);
      window.removeEventListener("scroll", medir, true);
    };
  }, [ativo, passoIndex, passosDisponiveis]);

  function encerrar() {
    setAtivo(false);
    try {
      window.localStorage.setItem(CHAVE_LOCALSTORAGE, "true");
    } catch {
      // sem localStorage (modo privado, etc) — só não persiste, sem quebrar nada
    }
  }

  function proximo() {
    if (passoIndex >= passosDisponiveis.length - 1) {
      encerrar();
      return;
    }
    setPassoIndex((i) => i + 1);
  }

  function voltar() {
    setPassoIndex((i) => Math.max(0, i - 1));
  }

  if (!ativo || !retangulo) return null;

  const passo = passosDisponiveis[passoIndex];
  if (!passo) return null;

  const PADDING = 6;
  const spot = {
    top: retangulo.top - PADDING,
    left: retangulo.left - PADDING,
    width: retangulo.width + PADDING * 2,
    height: retangulo.height + PADDING * 2,
  };

  // tooltip abaixo do alvo por padrão; se não couber, mostra acima —
  // funciona tanto pra barra horizontal (produtor) quanto sidebar (cooperativa)
  const TOOLTIP_LARGURA = 300;
  const espacoAbaixo = window.innerHeight - (spot.top + spot.height);
  const mostrarAcima = espacoAbaixo < 200 && spot.top > 200;
  const tooltipTop = mostrarAcima ? spot.top - 12 : spot.top + spot.height + 12;
  const tooltipLeft = Math.min(Math.max(spot.left, 12), window.innerWidth - TOOLTIP_LARGURA - 12);

  return (
    <div className="fixed inset-0 z-100" role="dialog" aria-modal="true">
      {/* overlay com "buraco" no elemento apontado, via box-shadow */}
      <div
        className="fixed rounded-lg transition-all duration-300"
        style={{
          top: spot.top,
          left: spot.left,
          width: spot.width,
          height: spot.height,
          boxShadow: "0 0 0 9999px rgba(20, 20, 15, 0.65)",
        }}
      />

      <div
        className={cn(
          "fixed w-75 rounded-xl border border-border bg-card p-4 shadow-2xl transition-all duration-300",
          mostrarAcima && "-translate-y-full",
        )}
        style={{ top: tooltipTop, left: tooltipLeft }}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-sm font-semibold text-foreground">{passo.titulo}</h3>
          <button
            type="button"
            onClick={encerrar}
            aria-label="Fechar tutorial"
            className="-mt-1 -mr-1 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{passo.descricao}</p>

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            {passosDisponiveis.map((p, i) => (
              <span
                key={p.rota}
                className={cn(
                  "size-1.5 rounded-full transition-colors",
                  i === passoIndex ? "bg-primary" : "bg-border",
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {passoIndex > 0 && (
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={voltar}>
                Voltar
              </Button>
            )}
            <Button size="sm" className="h-7 px-3 text-xs" onClick={proximo}>
              {passoIndex >= passosDisponiveis.length - 1 ? "Concluir" : "Próximo"}
            </Button>
          </div>
        </div>
        {passoIndex === 0 && (
          <button
            type="button"
            onClick={encerrar}
            className="mt-2 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Pular tutorial
          </button>
        )}
      </div>
    </div>
  );
}
