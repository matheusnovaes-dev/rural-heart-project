import { useEffect } from "react";
import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { buildWhatsAppLink } from "@/config/site";
import { trackLanding } from "@/lib/metaPixel";

let visualizacaoRegistrada = false;

/**
 * Tela logo depois do cadastro do produtor, antes do painel. Achado real
 * 2026-10-13: 85% dos trials (51 de 60) nunca mandaram uma mensagem pro bot, e
 * a mensagem de boas-vindas por template (que depende de a pessoa tocar num
 * botão e que a Meta barra em parte dos casos) quase não gera resposta. Aqui, no
 * momento de maior intenção, a própria pessoa começa a conversa: o botão abre o
 * WhatsApp com a pergunta já escrita, sem depender de template.
 */
export function CadastroConcluido({
  nome,
  cultura,
  aoIrParaOPainel,
}: {
  nome: string;
  cultura: string | null | undefined;
  aoIrParaOPainel: () => void;
}) {
  useEffect(() => {
    // A tela monta mais de uma vez na troca de sessão logo após o cadastro:
    // a marca fica fora do componente pra contar uma visualização só.
    if (visualizacaoRegistrada) return;
    visualizacaoRegistrada = true;
    trackLanding("AtivacaoCadastroVisto");
  }, []);

  const primeiroNome = nome.trim().split(" ")[0] || "tudo certo";
  const produto = cultura?.trim().toLowerCase();
  const pergunta = produto
    ? `Oi! Quanto tá o preço da ${produto} hoje?`
    : "Oi! Quero ver o preço de hoje.";

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <MessageCircle className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-xl font-semibold text-foreground">
          Conta criada, {primeiroNome}!
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Seu teste grátis de 7 dias já começou. O Safralume funciona no WhatsApp: toque no botão,
          mande a pergunta que já vai escrita e receba o preço da sua região em segundos.
        </p>
        <a
          href={buildWhatsAppLink(pergunta)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackLanding("AtivacaoWhatsappClique", { origem: "cadastro" })}
          className="mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-cta px-5 text-base font-bold text-cta-foreground shadow-lg shadow-cta/25 transition hover:bg-cta/90"
        >
          <MessageCircle className="size-5" aria-hidden="true" />
          Pedir meu primeiro preço
        </a>
        <Button variant="ghost" className="mt-3 w-full" onClick={aoIrParaOPainel}>
          Ir para o painel
        </Button>
      </div>
    </div>
  );
}
