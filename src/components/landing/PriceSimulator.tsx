import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  TrendingUp,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Truck,
  BadgeCheck,
  Loader2,
} from "lucide-react";

import { Reveal } from "@/components/landing/Reveal";

type CulturaId = "soja" | "milho" | "cafe" | "algodao" | "arroz" | "feijao" | "boi";
type UfId = "MT" | "PR" | "GO" | "RS" | "MG" | "BA";

// Subconjunto curado das ~77 culturas reais (ver config/culturas.ts) só pra
// esse simulador ilustrativo — não precisa cobrir tudo, é uma prévia.
const CULTURAS: Record<CulturaId, { label: string; unidade: string; base: number; tendencia: number }> = {
  soja: { label: "Soja", unidade: "saca de 60kg", base: 13200, tendencia: 2.1 },
  milho: { label: "Milho", unidade: "saca de 60kg", base: 7500, tendencia: -0.8 },
  cafe: { label: "Café arábica", unidade: "saca de 60kg", base: 145000, tendencia: 5.9 },
  algodao: { label: "Algodão", unidade: "@ de pluma", base: 13500, tendencia: 1.2 },
  arroz: { label: "Arroz", unidade: "saca de 60kg", base: 7200, tendencia: -1.5 },
  feijao: { label: "Feijão", unidade: "saca de 60kg", base: 22000, tendencia: 3.4 },
  boi: { label: "Boi gordo", unidade: "arroba", base: 37800, tendencia: 2.8 },
};

const UFS: Record<UfId, { label: string; fator: number; frete: number; origem: string; destino: string }> = {
  MT: { label: "Mato Grosso", fator: 1.0, frete: 3000, origem: "Confresa (MT)", destino: "Santos (SP)" },
  PR: { label: "Paraná", fator: 1.03, frete: 1800, origem: "Toledo (PR)", destino: "Paranaguá (PR)" },
  GO: { label: "Goiás", fator: 0.97, frete: 2200, origem: "Rio Verde (GO)", destino: "Santos (SP)" },
  RS: { label: "Rio Grande do Sul", fator: 1.05, frete: 1500, origem: "Passo Fundo (RS)", destino: "Rio Grande (RS)" },
  MG: { label: "Minas Gerais", fator: 0.99, frete: 2000, origem: "Uberlândia (MG)", destino: "Santos (SP)" },
  BA: { label: "Bahia", fator: 0.95, frete: 2600, origem: "Luís Eduardo Magalhães (BA)", destino: "Salvador (BA)" },
};

function fmt(centavos: number) {
  return (centavos / 100).toFixed(2).replace(".", ",");
}

function Chip({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3.5 py-1.5 text-sm font-semibold transition-all ${
        ativo
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground hover:border-primary"
      }`}
    >
      {children}
    </button>
  );
}

export function PriceSimulator() {
  const [cultura, setCultura] = useState<CulturaId>("soja");
  const [uf, setUf] = useState<UfId>("MT");
  const [calculando, setCalculando] = useState(false);
  const [revelado, setRevelado] = useState(false);

  function escolherCultura(id: CulturaId) {
    setCultura(id);
    setRevelado(false);
  }
  function escolherUf(id: UfId) {
    setUf(id);
    setRevelado(false);
  }
  function simular() {
    setCalculando(true);
    setRevelado(false);
    setTimeout(() => {
      setCalculando(false);
      setRevelado(true);
    }, 650);
  }

  const c = CULTURAS[cultura];
  const u = UFS[uf];
  const bruto = Math.round(c.base * u.fator);
  const liquido = bruto - u.frete;
  const diferenca = bruto - liquido;
  const tendUp = c.tendencia >= 0;

  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <Reveal className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3.5 py-1.5 text-xs font-semibold text-primary">
          <TrendingUp className="size-3.5" />
          Simulador rápido
        </span>
        <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Quanto você está perdendo sem saber o preço líquido?
        </h2>
        <p className="mt-2.5 text-muted-foreground">
          Escolhe sua cultura e seu estado, a simulação sai em segundos.
        </p>
      </Reveal>

      <Reveal delay={0.1} className="mx-auto mt-9 max-w-xl">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <p className="mb-2 text-xs font-semibold text-foreground">Cultura</p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(CULTURAS) as CulturaId[]).map((id) => (
              <Chip key={id} ativo={cultura === id} onClick={() => escolherCultura(id)}>
                {CULTURAS[id].label}
              </Chip>
            ))}
          </div>

          <p className="mb-2 mt-4.5 text-xs font-semibold text-foreground">Estado</p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(UFS) as UfId[]).map((id) => (
              <Chip key={id} ativo={uf === id} onClick={() => escolherUf(id)}>
                {UFS[id].label}
              </Chip>
            ))}
          </div>

          <button
            type="button"
            onClick={simular}
            disabled={calculando}
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-cta text-sm font-bold text-cta-foreground transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-cta/30 disabled:opacity-80"
          >
            {calculando ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Calculando...
              </>
            ) : (
              <>
                Simular agora
                <ArrowRight className="size-4" />
              </>
            )}
          </button>

          <AnimatePresence>
            {revelado && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="mt-6 border-t border-dashed border-border pt-6">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-[11px] font-semibold text-muted-foreground">PREÇO BRUTO</p>
                      <p className="font-display text-xl font-bold text-muted-foreground line-through decoration-destructive/50">
                        R${fmt(bruto)}
                      </p>
                    </div>
                    <ArrowRight className="mb-1.5 size-5 text-muted-foreground" />
                    <div className="text-right">
                      <p className="text-[11px] font-semibold text-primary">LÍQUIDO (com frete)</p>
                      <p className="font-display text-2xl font-extrabold text-primary">R${fmt(liquido)}</p>
                    </div>
                  </div>
                  <p className="mt-1.5 text-right text-[11px] text-muted-foreground">por {c.unidade}</p>

                  <div className="mt-3.5 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-gold-soft px-2.5 py-1 text-xs font-bold text-gold-foreground">
                      <AlertTriangle className="size-3" />
                      R${fmt(diferenca)} de diferença
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                        tendUp ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {tendUp ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                      {tendUp ? "+" : ""}
                      {c.tendencia.toFixed(1).replace(".", ",")}% na semana
                    </span>
                  </div>

                  <div className="mt-4 flex items-center gap-2.5 rounded-lg bg-secondary px-3 py-2.5">
                    <Truck className="size-4 shrink-0 text-primary" />
                    <p className="text-xs text-foreground">
                      Rota considerada: <strong>{u.origem} → {u.destino}</strong>
                    </p>
                  </div>

                  <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <BadgeCheck className="size-3" />
                    Fonte: Conab · exemplo ilustrativo
                  </p>

                  <a
                    href="#comece"
                    className="mt-4 flex items-center justify-center gap-1.5 text-sm font-bold text-primary hover:underline"
                  >
                    Quero receber isso automático no WhatsApp
                    <ArrowRight className="size-3.5" />
                  </a>

                  <p className="mt-3 text-center text-xs text-muted-foreground">
                    E isso é só uma fatia do que o Safralume faz: preço líquido pra qualquer cultura e
                    estado, clima oficial, tendência de mercado e alerta automático, tudo direto no seu
                    WhatsApp.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Reveal>
    </section>
  );
}
