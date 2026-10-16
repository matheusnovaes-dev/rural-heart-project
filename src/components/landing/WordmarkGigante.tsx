import { useRef } from "react";
import { useInView } from "framer-motion";

const SERIFA = '"Instrument Serif", "Times New Roman", serif';

/**
 * Assinatura gigante no rodapé (o fecho de página do site do Lando Norris): o nome em letra enorme, cada letra sobe de
 * uma máscara quando entra na tela e, no desktop, engorda e acende em laranja sob o mouse (peso da fonte variável,
 * só CSS). Serve também de fecho de marca antes dos avisos legais.
 */
export function WordmarkGigante({ nome }: { nome: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const visivel = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  return (
    <div
      ref={ref}
      className="relative overflow-hidden rounded-3xl bg-primary px-5 pt-9 pb-7 text-primary-foreground sm:px-10 sm:pt-14 sm:pb-9"
    >
      {/* container-type: a letra mede a largura do bloco (cqw), então nunca passa dela nem se sobrepõe */}
      <div className="[container-type:inline-size]">
        <p
          aria-label={nome}
          className="font-display flex w-full justify-between text-[20.2cqw] leading-[0.84] font-bold tracking-tighter select-none"
        >
          {Array.from(nome).map((letra, i) => (
            <span key={i} aria-hidden="true" className="palavra-mascara" style={{ margin: 0 }}>
              <span
                className="letra-viva inline-block motion-reduce:transition-none"
                style={{
                  transform: visivel ? "translateY(0)" : "translateY(112%)",
                  transition: `transform 900ms cubic-bezier(0.22, 1, 0.36, 1) ${i * 55}ms`,
                }}
              >
                {letra}
              </span>
            </span>
          ))}
        </p>
      </div>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-3 sm:mt-7">
        <p
          className="text-2xl text-[color:var(--cta)] italic sm:text-4xl"
          style={{ fontFamily: SERIFA }}
        >
          o preço certo na hora certa
        </p>
        <p className="text-xs font-medium text-primary-foreground/70 sm:text-sm">
          Dados oficiais, com fonte e data.
        </p>
      </div>
    </div>
  );
}
