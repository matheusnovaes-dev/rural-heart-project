import { useRef, type ElementType } from "react";
import { useInView } from "framer-motion";

import { cn } from "@/lib/utils";

const SERIFA = '"Instrument Serif", "Times New Roman", serif';

function Palavra({
  texto,
  indice,
  visivel,
  serifa,
  cor,
}: {
  texto: string;
  indice: number;
  visivel: boolean;
  serifa?: boolean;
  cor?: string | undefined;
}) {
  return (
    <span className="palavra-mascara">
      <span
        className={cn(
          "inline-block motion-reduce:transition-none",
          serifa && "text-[1.2em] leading-[0.8] font-normal tracking-normal",
        )}
        style={{
          ...(serifa ? { fontFamily: SERIFA } : {}),
          transform: visivel ? "translateY(0)" : "translateY(115%)",
          transition: `transform 750ms cubic-bezier(0.22, 1, 0.36, 1) ${Math.min(indice, 10) * 60}ms`,
        }}
      >
        {texto}
      </span>
    </span>
  );
}

/**
 * Título em duas vozes, como no site do Lando Norris: grotesca pesada (o texto normal) e serifa fina em caixa
 * alta (o trecho de destaque). Cada palavra sobe de dentro de uma máscara quando o título entra na tela.
 * Observa o título inteiro (e não cada palavra: o overflow da máscara as marcaria como fora da tela).
 * Leitores de tela recebem a frase inteira por aria-label.
 */
export function TituloDuasVozes({
  antes,
  serifa,
  className,
  id,
  como: Tag = "h2",
  corSerifa,
}: {
  antes?: string;
  serifa: string;
  className?: string;
  id?: string;
  /** Elemento ou componente que faz o papel de título (h1, h2 ou o DialogTitle do Radix). */
  como?: ElementType;
  /** Cor só do trecho em serifa (o resto herda a cor do título). */
  corSerifa?: string;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  const visivel = useInView(ref, { once: true, margin: "0px 0px -12% 0px" });
  const palavrasAntes = antes ? antes.split(" ") : [];
  const palavrasSerifa = serifa.split(" ");
  return (
    <Tag
      ref={ref}
      id={id}
      aria-label={[antes, serifa].filter(Boolean).join(" ")}
      className={cn(
        "font-display text-3xl font-bold tracking-tight text-balance sm:text-5xl",
        className,
      )}
    >
      <span aria-hidden="true">
        {palavrasAntes.map((p, i) => (
          <Palavra key={`a${i}`} texto={p} indice={i} visivel={visivel} />
        ))}
        {palavrasSerifa.map((p, i) => (
          <Palavra
            key={`s${i}`}
            texto={p}
            indice={palavrasAntes.length + i}
            visivel={visivel}
            serifa
            cor={corSerifa}
          />
        ))}
      </span>
    </Tag>
  );
}
