import { motion } from "framer-motion";
import { ArrowRight, Check, Sprout } from "lucide-react";

import { Reveal } from "@/components/landing/Reveal";
import { useExemplosDoDia } from "@/hooks/useExemplosDoDia";
import { brl2, diaMes, fraseDeFuturo, fraseDePlantio, fraseDeSinal } from "@/lib/exemplosLanding";

export function Solution() {
  return (
    <section className="bg-secondary/50 py-12 sm:py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
        <Reveal>
          {/* A antiga seção "O problema não é falta de dado" (3 cards) repetia
              o que o H1 do hero já diz: virou o título desta, que mostra a
              solução logo em seguida. Menos uma tela inteira no celular. */}
          <h2 className="font-display text-3xl font-bold tracking-tight text-balance text-foreground sm:text-4xl">
            O problema não é falta de dado. É não saber a hora certa.
          </h2>
          <p className="mt-4 max-w-md text-muted-foreground">
            Pergunte no WhatsApp e receba o preço da sua região, o do porto com frete e um sinal de
            que é hora de vender ou esperar, sempre com fonte e data.
          </p>
          <ul className="mt-6 space-y-3">
            {[
              "Fonte e data em toda resposta",
              "Preço da sua região comparado com o porto e o frete",
              "Sinal de venda: preço, futuros da B3 e clima juntos",
              "Alertas automáticos de preço e clima, sem precisar perguntar",
              "Foto ou PDF de proposta: compara com o mercado e ranqueia os compradores",
              "Mais de 70 culturas, de soja e milho a boi e café",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
          <a
            href="#planos"
            className="alvo-toque mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            Ver tudo que cada plano inclui
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </a>
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
  // Dólar, futuros e janela de plantio vêm do dado real do dia; os preços de
  // soja/boi no começo da conversa seguem ilustrativos (a legenda abaixo do
  // celular já diz isso). Sem dado, cai num texto sem número nem data fixa.
  const exemplos = useExemplosDoDia();
  const dolar = exemplos?.dolar;
  const futuro = exemplos?.futuroSoja;
  const plantio = exemplos?.plantio;
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
            viewport={{ once: true, amount: 0.6 }}
            transition={{ delay: 0.05, duration: 0.35 }}
            className="mr-auto max-w-[88%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm text-[#111b21] shadow-sm"
          >
            Bom dia! Pergunte o preço de qualquer cultura e cidade. 🌱
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ delay: 0.05, duration: 0.35 }}
            className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-sm text-[#111b21]"
          >
            Qual o preço da soja hoje em Cascavel?
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ delay: 0.05, duration: 0.35 }}
            className="mr-auto max-w-[88%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm text-[#111b21] shadow-sm"
          >
            <p>
              Soja em Cascavel/PR hoje: <strong>R$ 151,00/saca</strong>. No porto de Paranaguá a
              saca vale R$ 162,50. Tirando o frete (R$ 12,30), sobram R$ 150,20.
            </p>
            <p className="mt-1">
              Paraná está vendendo 3,8% acima da média de 5 outros estados que acompanhamos.
            </p>
            <p className="mt-1 text-xs text-[#667781]">Fonte: BBM · atualizado às 08:12</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ delay: 0.05, duration: 0.35 }}
            className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-sm text-[#111b21]"
          >
            📷 Foto da proposta da Cargill
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ delay: 0.05, duration: 0.35 }}
            className="mr-auto max-w-[88%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm text-[#111b21] shadow-sm"
          >
            <p>
              📄 Estudo da proposta: Cargill paga <strong>R$ 126,00/saca</strong> em 30 dias (R$
              124,75 à vista).
            </p>
            <p className="mt-1">
              O mercado hoje está em R$ 137,88: a proposta fica 9% abaixo. Vale negociar.
            </p>
            <p className="mt-1 text-xs text-[#667781]">Fonte: BBM · atualizado às 08:15</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ delay: 0.05, duration: 0.35 }}
            className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-sm text-[#111b21]"
          >
            Vale mais vender a soja agora ou esperar um pouco?
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ delay: 0.05, duration: 0.35 }}
            className="mr-auto max-w-[88%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm text-[#111b21] shadow-sm"
          >
            <p>💵 Dólar hoje (PTAX): {dolar ? `R$ ${brl2(dolar.valor)}` : "cotação do dia"}</p>
            <p className="mt-1">
              📈 Mercado futuro (B3), soja:{" "}
              {futuro ? fraseDeFuturo(futuro) : "próximos vencimentos com preço de ajuste"}
            </p>
            <p className="mt-1">🎯 {fraseDeSinal(futuro ?? null)}</p>
            <p className="mt-1 text-xs text-[#667781]">
              Fonte: BCB + B3 · {dolar ? `PTAX de ${diaMes(dolar.data)}` : "atualizado hoje"}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ delay: 0.05, duration: 0.35 }}
            className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-sm text-[#111b21]"
          >
            Posso plantar soja hoje em Sorriso/MT?
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ delay: 0.05, duration: 0.35 }}
            className="mr-auto max-w-[88%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm text-[#111b21] shadow-sm"
          >
            <p>
              🌱{" "}
              {plantio
                ? fraseDePlantio(plantio)
                : "A janela recomendada de plantio e o risco climático saem direto do ZARC/MAPA."}
            </p>
            <p className="mt-1 text-xs text-[#667781]">Fonte: ZARC/MAPA · atualizado agora</p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
