import { motion } from "framer-motion";
import { Check, Sprout } from "lucide-react";

import { Reveal } from "@/components/landing/Reveal";

export function Solution() {
  return (
    <section className="bg-secondary/50 py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
        <Reveal>
          <span className="text-sm font-semibold uppercase tracking-wide text-primary">
            Como funciona na prática
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Você pergunta. O Safralume responde com o preço líquido.
          </h2>
          <p className="mt-4 max-w-md text-muted-foreground">
            Cruzamos os dados oficiais do Cepea e da Conab com o frete da sua região na hora — sem
            você abrir planilha nenhuma.
          </p>
          <ul className="mt-6 space-y-3">
            {[
              "Fonte e data sempre visíveis em cada resposta",
              "Frete já descontado do preço da bolsa",
              "Funciona mesmo com internet fraca no campo",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                {item}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.15} className="flex flex-col items-center gap-3">
          <PhoneMockup />
          <p className="text-xs text-muted-foreground">Exemplo ilustrativo de conversa</p>
        </Reveal>
      </div>
    </section>
  );
}

function PhoneMockup() {
  return (
    <div className="w-full max-w-sm rounded-[2.25rem] border-8 border-[oklch(0.244_0.026_155.8)] bg-[oklch(0.244_0.026_155.8)] shadow-2xl">
      <div className="overflow-hidden rounded-[1.75rem] bg-[#e5ded4]">
        <div className="flex items-center gap-3 bg-[oklch(0.331_0.049_156.2)] px-4 py-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-white/15 text-white">
            <Sprout className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">Safralume</p>
            <p className="text-xs text-white/70">online</p>
          </div>
        </div>

        <div className="flex min-h-80 flex-col justify-end gap-2 px-3 py-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="mr-auto max-w-[88%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm text-[#111b21] shadow-sm"
          >
            Bom dia! Pergunte o preço de qualquer cultura e cidade. 🌱
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-sm text-[#111b21]"
          >
            Qual o preço da soja hoje em Rio Verde?
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.7, duration: 0.4 }}
            className="mr-auto max-w-[88%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm text-[#111b21] shadow-sm"
          >
            <p>
              Soja em Rio Verde/GO hoje: <strong>R$ 131,40/saca líquido</strong> (frete já
              descontado).
            </p>
            <p className="mt-1 text-xs text-[#667781]">Fonte: Cepea · atualizado às 08:12</p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
