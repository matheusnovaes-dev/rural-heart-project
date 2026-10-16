import { useMercadoDoDia } from "@/hooks/useMercadoDoDia";
import { brl, diaMesCurto, type ItemDoMercado } from "@/lib/mercadoLanding";

/**
 * Faixa de preços REAIS do dia, rolando no topo do hero (BBM e Banco Central, com a variação de 7 dias).
 * Fica sobre a foto (position absolute, altura fixa): quando o dado chega não empurra nada, então não gera
 * deslocamento de layout. Só anima transform (mesmo loop contínuo do ticker do painel); sem dado, não mostra nada
 * em vez de mostrar número inventado. Quem prefere menos movimento recebe a faixa parada e rolável com o dedo.
 */
export function TickerPrecos() {
  const mercado = useMercadoDoDia();
  const itens = mercado?.itens ?? [];
  const dataRef = itens.reduce((m, i) => (i.data > m ? i.data : m), "");

  return (
    <div
      aria-label="Preços de referência do dia"
      className="pointer-events-none absolute inset-x-0 top-0 z-10 h-9 overflow-hidden border-b border-white/10 bg-black/35 text-xs text-white sm:h-10 sm:text-[13px] motion-reduce:pointer-events-auto motion-reduce:overflow-x-auto"
    >
      <div
        className={`flex h-full w-max items-center gap-7 whitespace-nowrap pl-4 transition-opacity duration-700 ${itens.length ? "animate-marquee-lento opacity-100" : "opacity-0"}`}
      >
        {[0, 1].map((copia) => (
          <div
            key={copia}
            aria-hidden={copia === 1 ? true : undefined}
            className="flex items-center gap-7"
          >
            <span className="flex items-center gap-1.5 font-semibold tracking-wide text-[color:var(--cta)] uppercase">
              <span className="size-1.5 rounded-full bg-[color:var(--cta)]" aria-hidden="true" />
              Preços de hoje{dataRef ? ` · ${diaMesCurto(dataRef)}` : ""}
            </span>
            {itens.map((i) => (
              <Item key={`${copia}-${i.id}`} item={i} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Item({ item }: { item: ItemDoMercado }) {
  const v = item.varPct;
  const sobe = v !== null && v > 0.05;
  const desce = v !== null && v < -0.05;
  const valor = item.unidade === "dolar" ? `R$ ${brl(item.valor, 4)}` : `R$ ${brl(item.valor)}`;
  return (
    <span className="flex items-baseline gap-2">
      <span className="text-white/70">{item.rotulo}</span>
      <span className="font-semibold tabular-nums">{valor}</span>
      {v !== null ? (
        <span
          className={`font-semibold tabular-nums ${sobe ? "text-[#7be0a0]" : desce ? "text-[#ff8a7a]" : "text-white/60"}`}
        >
          {sobe ? "▲" : desce ? "▼" : "•"} {brl(Math.abs(v), 1)}%
        </span>
      ) : null}
    </span>
  );
}
