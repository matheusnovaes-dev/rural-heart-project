import { lazy, Suspense, useEffect, useRef, useState, type ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * O formulário de cadastro (react-hook-form, zod, seletores) só é preciso depois de um toque no CTA ou no fim da página,
 * então fica fora do carregamento inicial da landing (menos JS pro celular simples). `precarregarLeadForm` baixa o pedaço
 * antes de a pessoa precisar: com a página ociosa e assim que ela toca no campo de WhatsApp.
 */
const importar = () => import("@/components/landing/LeadForm");
const LeadFormLazy = lazy(() => importar().then((m) => ({ default: m.LeadForm })));

let pedido = false;
export function precarregarLeadForm() {
  if (pedido) return;
  pedido = true;
  void importar().catch(() => {
    pedido = false;
  });
}

type Props = ComponentProps<typeof LeadFormLazy>;

/** Esqueleto com a altura do formulário real, pra nada pular quando ele chega. */
function Esqueleto({ className }: { className?: string }) {
  return (
    <div
      aria-busy="true"
      className={cn(
        "flex min-h-[21.5rem] flex-col gap-4 sm:min-h-[19rem] lg:min-h-[20rem]",
        className,
      )}
    >
      <div className="bg-muted/70 h-1 rounded-full" />
      <div className="bg-muted/60 h-5 w-24 rounded-md" />
      <div className="bg-muted/60 h-11 rounded-md" />
      <div className="bg-muted/60 h-12 rounded-md" />
    </div>
  );
}

/** Dentro do modal (já aberto por um toque): carrega na hora, com esqueleto enquanto o pedaço chega. */
export function LeadFormCarregavel(props: Props) {
  return (
    <Suspense
      fallback={
        <Esqueleto {...(props.className ? { className: cn("p-6 sm:p-8", props.className) } : {})} />
      }
    >
      <LeadFormLazy {...props} />
    </Suspense>
  );
}

/**
 * No fim da página: o servidor e a primeira pintura mostram só o esqueleto (mesma altura); o formulário monta quando a
 * área chega perto da tela, ou depois de alguns segundos ociosos (quem usa o link #comece cai direto aqui).
 */
export function LeadFormAoChegar(props: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [montar, setMontar] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || montar) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) setMontar(true);
      },
      { rootMargin: "900px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [montar]);

  return (
    <div ref={ref}>
      {montar ? (
        <LeadFormCarregavel {...props} />
      ) : (
        <Esqueleto {...(props.className ? { className: cn("p-6 sm:p-8", props.className) } : {})} />
      )}
    </div>
  );
}
