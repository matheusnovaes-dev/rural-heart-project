import { lazy, Suspense, useRef } from "react";
import { useScroll } from "framer-motion";
import { TituloDuasVozes } from "@/components/landing/TituloDuasVozes";
import { ShieldCheck } from "lucide-react";

import { Reveal } from "@/components/landing/Reveal";
import { MIDIA } from "@/assets/midia";
import { Grao } from "@/components/landing/Grao";
import { RevelarImagem } from "@/components/landing/RevelarImagem";
import { useDesktopFino } from "@/components/landing/desktop/useDesktopFino";

// Desktop com mouse e máquina boa: no lugar da foto entra o mapa 3D com o caminho de cada fonte até a resposta. O
// pedaço só é baixado nessa condição; celular e quem pede menos movimento ficam com a foto.
const CaminhoDoDado = lazy(() => import("@/components/landing/desktop/CaminhoDoDado"));
// "Do grão ao número": abertura do capítulo em partículas (só desktop bom; ver GraoAoNumero).
const GraoAoNumero = lazy(() => import("@/components/landing/desktop/GraoAoNumero"));

const FONTES = [
  "Conab",
  "Imea",
  "Deral/PR",
  "Epagri/SC",
  "Emater/RS",
  "BBM",
  "IEA-SP",
  "B3",
  "Conseleite",
];

export function TrustProof() {
  return (
    <section
      id="fontes"
      data-cortina
      className="relative bg-primary py-12 sm:py-20 text-primary-foreground"
    >
      <Grao />
      <GraoAoNumeroCasca />
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 xl:pl-[max(1.5rem,calc(11.5rem-(100vw-72rem)/2))]">
        <FotoOuMapa />

        <Reveal delay={0.1}>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium">
            <ShieldCheck className="size-3.5" />
            Fonte oficial, sempre visível
          </div>

          <TituloDuasVozes
            antes="Dado com origem clara, não"
            serifa="ACHISMO DE IA"
            className="mt-4 sm:text-4xl lg:text-5xl desk:text-6xl"
          />

          <p className="mt-4 max-w-lg text-primary-foreground/85 desk:mt-6 desk:text-lg">
            Todo preço mostrado no Safralume vem de fontes públicas e abertas: Conab pra cobertura
            nacional, mais órgãos estaduais, institutos e bolsas onde eles dão um número mais
            completo. Sempre com data de referência visível na resposta. O Safralume apresenta
            cenários de mercado com base em dados públicos, não é recomendação de investimento nem
            consultoria financeira.
          </p>

          <p className="mt-3 max-w-lg text-sm text-primary-foreground/70">
            Soja, milho, algodão, café, boi, leite, feijão, trigo, arroz e mais de 70 produtos.
            Quando duas fontes cobrem a mesma cultura e estado, cruzamos uma com a outra antes de
            mostrar o número.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {FONTES.map((fonte) => (
              <span
                key={fonte}
                data-fonte={fonte}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-semibold tracking-wide transition-colors hover:border-[oklch(0.85_0.15_95)]/70 hover:bg-white/10"
              >
                <span className="size-1.5 rounded-full bg-[oklch(0.85_0.15_95)]" />
                {fonte}
              </span>
            ))}
          </div>

          <p className="mt-6 text-sm font-medium text-primary-foreground/70">
            Feito para chegar até você pela sua cooperativa, corretor de grãos ou agrônomo de
            confiança.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/**
 * Casca da abertura "do grão ao número": uma caixa alta que já existe no HTML do servidor só no desktop (variante `desk`),
 * então a página não pula quando o efeito chega. Máquina boa recebe as partículas (pedaço baixado só aí); máquina fraca
 * ou quem pede menos movimento fica com a versão parada (o número e a frase final), sem caixa vazia.
 */
function GraoAoNumeroCasca() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const fino = useDesktopFino();
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="relative hidden h-[240vh] desk:-mt-20 desk:mb-12 desk:block"
    >
      {fino ? (
        <Suspense fallback={null}>
          <GraoAoNumero progresso={scrollYProgress} />
        </Suspense>
      ) : (
        <div className="sticky top-0 flex h-screen items-center px-10 xl:pl-[11.5rem]">
          <div className="max-w-xl">
            <p className="text-sm font-semibold tracking-[0.2em] text-[oklch(0.86_0.13_80)] uppercase">
              Do grão ao número
            </p>
            <p className="mt-4 font-display text-6xl leading-[1.02] font-extrabold tracking-tight">
              Milhares de números públicos por dia. Um número certo pra você.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function FotoOuMapa() {
  const desktop = useDesktopFino();
  const foto = (
    <RevelarImagem>
      <picture>
        <source
          srcSet={`${MIDIA.soja640} 640w, ${MIDIA.sojaWebp} 1000w`}
          sizes="(max-width: 1024px) 100vw, 50vw"
          type="image/webp"
        />
        <img
          src={MIDIA.sojaJpg}
          alt="Lavoura de soja"
          data-parallax
          className="h-72 w-full object-cover sm:h-96"
          loading="lazy"
        />
      </picture>
    </RevelarImagem>
  );
  if (!desktop) return foto;
  return (
    <Suspense fallback={foto}>
      <CaminhoDoDado />
    </Suspense>
  );
}
