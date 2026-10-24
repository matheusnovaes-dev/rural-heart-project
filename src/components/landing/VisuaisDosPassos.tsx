import { Check } from "lucide-react";

/**
 * Ilustrações dos três passos de "Como funciona" (conversa, fontes, resposta). Usadas no painel horizontal do desktop e,
 * empilhadas em cartões leves, no celular. Cada elemento entra com atraso quando o ancestral com a classe `group` ganha
 * data-ativo="true" (só opacidade e transform, sem JS por quadro).
 */

const FONTES = [
  "Conab",
  "Imea",
  "Deral/PR",
  "Epagri/SC",
  "Emater/RS",
  "BBM",
  "IEA-SP",
  "B3",
  "Banco Central",
];

/** Atraso (ms) de cada elemento de uma ilustração depois que o painel fica ativo. */
const atraso = (ms: number) => ({ transitionDelay: `${ms}ms` });
const entra =
  "translate-y-4 opacity-0 transition-[opacity,transform] duration-700 ease-out group-data-[ativo=true]:translate-y-0 group-data-[ativo=true]:opacity-100";

export function Conversa() {
  return (
    <div className="mx-auto w-full max-w-md overflow-hidden rounded-3xl bg-[#e8e1d3] shadow-xl ring-1 ring-black/5">
      <div className="flex items-center gap-2 bg-primary px-4 py-3 text-primary-foreground">
        <span className="flex size-8 items-center justify-center rounded-full bg-white/15 text-xs font-bold">
          S
        </span>
        <span className="text-sm font-semibold">Safralume</span>
        <span className="ml-auto text-xs text-primary-foreground/60">online</span>
      </div>
      <div className="flex min-h-[15.5rem] flex-col gap-3 p-4 sm:min-h-[19rem]">
        <p
          className={`${entra} ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-[#d8f2c4] px-3.5 py-2.5 text-sm text-[#1b2b1d]`}
          style={atraso(150)}
        >
          Qual o preço da soja em Cascavel?
        </p>
        <p
          className={`${entra} flex w-fit items-center gap-1 rounded-2xl rounded-tl-sm bg-white px-4 py-3`}
          style={atraso(750)}
          aria-hidden="true"
        >
          <span className="passos-ponto" />
          <span className="passos-ponto [animation-delay:150ms]" />
          <span className="passos-ponto [animation-delay:300ms]" />
        </p>
        <p
          className={`${entra} max-w-[88%] rounded-2xl rounded-tl-sm bg-white px-3.5 py-2.5 text-sm text-[#1b2b1d]`}
          style={atraso(1500)}
        >
          Soja no Paraná: preço da sua região, comparado com o porto e já com o frete.
          <span className="mt-1.5 block text-xs text-[#1b2b1d]/72">
            Fonte e data em toda resposta
          </span>
        </p>
      </div>
    </div>
  );
}

export function Fontes() {
  return (
    <div className="mx-auto w-full max-w-md">
      <ul className="flex flex-wrap justify-center gap-2.5">
        {FONTES.map((f, i) => (
          <li
            key={f}
            className={`${entra} inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card px-4 py-2 text-sm font-semibold text-primary shadow-sm`}
            style={atraso(i * 110)}
          >
            <Check className="size-3.5 text-[color:var(--cta)]" aria-hidden="true" />
            {f}
          </li>
        ))}
      </ul>
      <p
        className={`${entra} mt-6 text-center text-sm font-medium text-muted-foreground`}
        style={atraso(1200)}
      >
        Duas fontes cobrindo a mesma cultura e estado? Cruzamos uma com a outra antes de mostrar.
      </p>
    </div>
  );
}

export function Resposta() {
  const linhas = [
    ["Preço na sua região", "R$ 134,98"],
    ["No porto de Paranaguá", "R$ 155,50"],
    ["Frete até o porto", "R$ 11,77"],
  ] as const;
  return (
    <div className="mx-auto w-full max-w-md rounded-3xl bg-primary p-6 text-primary-foreground shadow-xl">
      <p
        data-decodificar="tudo"
        className="text-xs font-semibold tracking-[0.2em] text-primary-foreground/60 uppercase"
      >
        Soja · saca de 60 kg
      </p>
      <ul className="mt-4 divide-y divide-white/10">
        {linhas.map(([rotulo, valor], i) => (
          <li
            key={rotulo}
            className={`${entra} flex items-baseline justify-between gap-4 py-3`}
            style={atraso(150 + i * 250)}
          >
            <span className="text-sm text-primary-foreground/80">{rotulo}</span>
            <span data-decodificar className="font-mono text-lg font-semibold tabular-nums">
              {valor}
            </span>
          </li>
        ))}
      </ul>
      <p
        className={`${entra} mt-3 flex items-baseline justify-between gap-4 rounded-xl bg-white/10 px-4 py-3`}
        style={atraso(1000)}
      >
        <span className="text-sm font-semibold">Sobra na paridade</span>
        <span
          data-decodificar
          className="font-mono text-2xl font-bold text-[color:var(--cta)] tabular-nums"
        >
          R$ 143,73
        </span>
      </p>
      <p className={`${entra} mt-3 text-xs text-primary-foreground/55`} style={atraso(1250)}>
        Fonte: BBM, com data de referência
      </p>
    </div>
  );
}
