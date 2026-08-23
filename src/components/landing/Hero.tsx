import { motion } from "framer-motion";
import { ArrowRight, BadgeCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section id="topo" className="relative overflow-hidden">
      <div className="absolute inset-0">
        <img
          src="/images/hero-field.jpg"
          alt="Lavoura ao entardecer"
          className="size-full object-cover"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[oklch(0.16_0.03_158/0.88)] via-[oklch(0.16_0.03_158/0.78)] to-[oklch(0.988_0.005_95.1)]" />
      </div>

      <div className="relative mx-auto flex max-w-4xl flex-col items-center px-4 py-24 text-center sm:px-6 sm:py-32">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-medium text-white/90"
        >
          <BadgeCheck className="size-3.5" />
          Dados oficiais Cepea e Conab
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-balance text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl md:text-6xl"
        >
          Saiba o preço líquido da sua saca, direto no WhatsApp
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-5 max-w-2xl text-pretty text-lg text-white/85"
        >
          Sem planilha, sem relatório complicado. O Safralume já desconta o frete e te manda o
          número certo, na hora que você precisa decidir.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-8"
        >
          <Button
            asChild
            size="lg"
            className="bg-cta text-cta-foreground hover:bg-cta/90 h-12 px-8 text-base"
          >
            <a href="#comece">
              Testar grátis por 7 dias
              <ArrowRight className="size-4" />
            </a>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
