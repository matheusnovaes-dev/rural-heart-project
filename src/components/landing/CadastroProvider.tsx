import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LeadForm, registrarInicioDeCadastro } from "@/components/landing/LeadForm";
import { trackLanding } from "@/lib/metaPixel";

export type AbrirCadastroOpcoes = {
  /** Qual CTA abriu o cadastro (só pra medir qual converte). */
  origem?: "hero" | "barra_fixa" | "calculadora";
  /** WhatsApp já digitado em algum CTA: o cadastro abre direto na etapa 2. */
  whatsapp?: string;
  /** Cultura/UF já escolhidas na calculadora, pra não pedir de novo. */
  cultura?: string;
  uf?: string;
};

type CadastroContexto = {
  abrirCadastro: (opcoes?: AbrirCadastroOpcoes) => void;
  /** A barra de CTA fixa (celular) está visível: o botão flutuante do WhatsApp sai da frente. */
  barraFixaVisivel: boolean;
  setBarraFixaVisivel: (v: boolean) => void;
  /** O campo de WhatsApp do hero está na tela (no celular, o botão flutuante some pra não cobrir o hero). */
  heroEmTela: boolean;
  setHeroEmTela: (v: boolean) => void;
  /** Algum CTA "inline" (ex: painel da calculadora) está na tela: a barra fixa não repete o convite. */
  ctaInlineVisivel: boolean;
  setCtaInlineVisivel: (v: boolean) => void;
};

// Fora do provider (ex: um componente da landing reaproveitado em outra
// página) o CTA cai no formulário do rodapé em vez de quebrar.
const contextoPadrao: CadastroContexto = {
  abrirCadastro: () => {
    window.location.assign("/#comece");
  },
  barraFixaVisivel: false,
  setBarraFixaVisivel: () => {},
  heroEmTela: true,
  setHeroEmTela: () => {},
  ctaInlineVisivel: false,
  setCtaInlineVisivel: () => {},
};

const Contexto = createContext<CadastroContexto>(contextoPadrao);

export function useCadastro() {
  return useContext(Contexto);
}

type Sessao = { id: number; opcoes: AbrirCadastroOpcoes };

/**
 * Um único cadastro pra todos os CTAs da landing (hero, barra fixa,
 * calculadora): abre num modal que vira bottom sheet no celular, sem levar a
 * pessoa 10 mil pixels abaixo até o formulário do rodapé. O formulário é o
 * mesmo LeadForm (mesma criação de conta, mesmo rastreio de Pixel/CAPI).
 */
export function CadastroProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const conteudoRef = useRef<HTMLDivElement>(null);
  const [barraFixaVisivel, setBarraFixaVisivel] = useState(false);
  const [heroEmTela, setHeroEmTela] = useState(true);
  const [ctaInlineVisivel, setCtaInlineVisivel] = useState(false);

  const abrirCadastro = useCallback((opcoes: AbrirCadastroOpcoes = {}) => {
    // Número já digitado = início do cadastro registrado aqui, uma vez, e o
    // formulário abre na etapa 2 sem registrar de novo.
    if (opcoes.whatsapp) registrarInicioDeCadastro(opcoes.whatsapp);
    trackLanding("CadastroAberto", {
      origem: opcoes.origem ?? "outro",
      comWhatsapp: !!opcoes.whatsapp,
    });
    setSessao({ id: Date.now(), opcoes });
  }, []);

  const valor = useMemo(
    () => ({
      abrirCadastro,
      barraFixaVisivel,
      setBarraFixaVisivel,
      heroEmTela,
      setHeroEmTela,
      ctaInlineVisivel,
      setCtaInlineVisivel,
    }),
    [abrirCadastro, barraFixaVisivel, heroEmTela, ctaInlineVisivel],
  );

  const jaTemWhatsapp = !!sessao?.opcoes.whatsapp;
  // Foco automático só com mouse: no celular o teclado subiria na hora e
  // cobriria o próprio formulário (Web Interface Guidelines: autoFocus com parcimônia).
  const podeAutoFocar =
    typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;

  return (
    <Contexto.Provider value={valor}>
      {children}
      <Dialog open={sessao != null} onOpenChange={(aberto) => !aberto && setSessao(null)}>
        <DialogContent
          ref={conteudoRef}
          className="gap-5 overscroll-contain p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:max-h-[92dvh] max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:overflow-y-auto max-sm:rounded-b-none max-sm:rounded-t-3xl max-sm:border-x-0 max-sm:data-[state=closed]:slide-out-to-bottom max-sm:data-[state=open]:slide-in-from-bottom max-sm:data-[state=closed]:zoom-out-100 max-sm:data-[state=open]:zoom-in-100 sm:max-w-md sm:rounded-2xl motion-reduce:animate-none"
          onOpenAutoFocus={(e) => {
            if (podeAutoFocar) return;
            // Celular: sem prevenir, o foco ficaria no campo do hero (agora
            // escondido atrás do modal) e o teclado do iOS continuaria aberto
            // por cima do cadastro. Tira o foco de lá e leva pro próprio
            // diálogo (tabIndex -1 do Radix), pro leitor de tela também.
            e.preventDefault();
            if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
            conteudoRef.current?.focus({ preventScroll: true });
          }}
        >
          <DialogHeader className="pr-6 text-left">
            <DialogTitle className="font-display text-2xl leading-tight font-bold">
              {jaTemWhatsapp ? "Falta pouco pro seu teste grátis" : "Teste grátis por 7 dias"}
            </DialogTitle>
            <DialogDescription>
              {jaTemWhatsapp
                ? "Só mais 3 dados e seu painel fica pronto."
                : "Comece pelo seu WhatsApp. Leva menos de 1 minuto."}
            </DialogDescription>
          </DialogHeader>
          {sessao && (
            <LeadForm
              key={sessao.id}
              iniciarNaEtapa2={jaTemWhatsapp}
              autoFocar={podeAutoFocar}
              valoresIniciais={{
                whatsapp: sessao.opcoes.whatsapp,
                crop: sessao.opcoes.cultura,
                uf: sessao.opcoes.uf,
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Contexto.Provider>
  );
}
