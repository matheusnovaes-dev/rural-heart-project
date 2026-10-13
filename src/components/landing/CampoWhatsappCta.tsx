import { useId, useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { mascararTelefone, telefoneValido } from "@/lib/telefone";

/**
 * Campo de WhatsApp + botão, o CTA principal da landing (hero e calculadora).
 * Pedir o número ali mesmo, em vez de um botão que rola a página, começa o
 * cadastro no instante da decisão: quem digita já se comprometeu e o número
 * fica salvo mesmo que desista na etapa 2. Duas variantes só de cor:
 * "escuro" sobre foto/fundo verde, "claro" sobre card claro.
 */
export function CampoWhatsappCta({
  aoEnviar,
  variante,
  rotulo = "Seu WhatsApp",
  className,
}: {
  aoEnviar: (whatsapp: string) => void;
  variante: "escuro" | "claro";
  rotulo?: string;
  className?: string;
}) {
  const id = useId();
  const erroId = `${id}-erro`;
  const [valor, setValor] = useState("");
  const [erro, setErro] = useState("");

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (!telefoneValido(valor)) {
      setErro("Digite seu WhatsApp com DDD.");
      return;
    }
    setErro("");
    // iOS Safari não tira o foco do campo ao tocar num botão: sem isso o
    // teclado ficaria aberto por cima do cadastro que vai abrir.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    aoEnviar(valor);
  }

  const escuro = variante === "escuro";

  return (
    <form onSubmit={enviar} noValidate className={cn("w-full", className)}>
      <label
        htmlFor={id}
        className={cn(
          "mb-1.5 block text-left text-sm font-semibold",
          escuro ? "text-white/90" : "text-foreground",
        )}
      >
        {rotulo}
      </label>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <input
          id={id}
          name="whatsapp"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          spellCheck={false}
          placeholder="(11) 91234-5678"
          value={valor}
          onChange={(e) => {
            setValor(mascararTelefone(e.target.value));
            if (erro) setErro("");
          }}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? erroId : undefined}
          className={cn(
            "h-14 w-full min-w-0 rounded-xl border bg-white px-4 text-base font-medium text-[#14201a] shadow-sm transition-shadow placeholder:font-normal placeholder:text-[#5b6b62] focus-visible:ring-4 focus-visible:ring-cta/40 focus-visible:outline-none sm:flex-1",
            erro ? "border-destructive" : escuro ? "border-white/30" : "border-border",
          )}
        />
        <button
          type="submit"
          className="inline-flex h-14 shrink-0 touch-manipulation items-center justify-center gap-2 rounded-xl bg-cta px-6 text-base font-bold whitespace-nowrap text-cta-foreground shadow-lg shadow-cta/25 transition-[transform,box-shadow,background-color] hover:-translate-y-0.5 hover:bg-cta/90 hover:shadow-xl hover:shadow-cta/30 focus-visible:ring-4 focus-visible:ring-cta/40 focus-visible:outline-none active:translate-y-0 active:scale-[0.98] motion-reduce:transition-none"
        >
          Testar grátis por 7 dias
          <ArrowRight className="size-4" aria-hidden="true" />
        </button>
      </div>
      {/* Consentimento pra mensagem no WhatsApp (a Meta exige aceite pra mensagem
          que a empresa inicia e a recuperação de cadastro depende disso). Mora
          junto do campo porque é aqui que o número é dado: hero e calculadora
          abrem o cadastro direto na etapa 2, onde este aviso não aparece. */}
      <p
        className={cn(
          "mt-2 text-center text-[11px] leading-snug text-balance",
          escuro ? "text-white/75" : "text-muted-foreground",
        )}
      >
        Ao continuar, você aceita receber mensagens da Safralume no WhatsApp. Para parar, é só
        responder SAIR.
      </p>
      <p
        id={erroId}
        role="alert"
        aria-live="polite"
        className={cn(
          "mt-2 text-left text-sm font-medium",
          erro ? (escuro ? "text-red-200" : "text-destructive") : "sr-only",
        )}
      >
        {erro}
      </p>
    </form>
  );
}
