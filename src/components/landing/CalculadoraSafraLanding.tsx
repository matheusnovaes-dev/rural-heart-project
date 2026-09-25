import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Calculator, Loader2 } from "lucide-react";

import { Reveal } from "@/components/landing/Reveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { culturas, DESTAQUES } from "@/config/culturas";
import { ufs } from "@/config/ufs";
import { calcularValorProducaoPublico } from "@/lib/calculadora.server";
import type { ResultadoCalculadora } from "@/lib/calculadora";

const culturasMaisUsadas = culturas.filter((c) => DESTAQUES.includes(c.value));
const culturasOutras = culturas.filter((c) => !DESTAQUES.includes(c.value));
const nomeDaUf = (uf: string) => ufs.find((u) => u.value === uf)?.label ?? uf;

const brl = (n: number) =>
  `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Substitui o antigo "Simulador rápido" (dado 100% inventado, só rotulado
 * "exemplo ilustrativo") por uma calculadora de verdade: preço real de
 * mercado, buscado no servidor com service role (precos é só pra
 * autenticado). É a mesma conta de src/lib/calculadora.ts que o painel e o
 * bot usam — fonte única, sem número divergindo entre landing e produto.
 * Sem custo de produção aqui de propósito: pedir isso de quem ainda nem se
 * cadastrou é demais pra esse ponto da jornada; a landing só mostra o valor
 * bruto real, a margem fica pro painel depois do cadastro.
 */
export function CalculadoraSafraLanding() {
  const [cultura, setCultura] = useState("soja");
  const [uf, setUf] = useState("");
  const [sacas, setSacas] = useState("");
  const [calculando, setCalculando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoCalculadora | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // Separado do resultado calculado de propósito: o cálculo já escolhe a UF
  // de referência mais recente sozinho, então "trocar" só reabre a lista
  // (sem isso, "trocar" recalcularia e cairia de volta na mesma escolha).
  const [escolhendoUf, setEscolhendoUf] = useState(false);

  const sacasNum = Number(sacas.replace(/\./g, "").replace(",", "."));
  const sacasValidas = sacas.trim() !== "" && Number.isFinite(sacasNum) && sacasNum > 0;

  async function calcular(ufEscolhida?: string) {
    if (!uf || !sacasValidas) return;
    setCalculando(true);
    setErro(null);
    setEscolhendoUf(false);
    try {
      const r = await calcularValorProducaoPublico({
        data: { cultura, uf, sacas: sacasNum, ufReferencia: ufEscolhida ?? null },
      });
      setResultado(r);
    } catch {
      setErro("Não consegui calcular agora. Tenta de novo em instantes.");
      setResultado(null);
    } finally {
      setCalculando(false);
    }
  }

  function reiniciar() {
    setResultado(null);
    setErro(null);
    setEscolhendoUf(false);
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <Reveal className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3.5 py-1.5 text-xs font-semibold text-primary">
          <Calculator className="size-3.5" />
          Calculadora de safra
        </span>
        <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Quanto sua produção vale hoje?
        </h2>
        <p className="mt-2.5 text-muted-foreground">
          Cultura, estado e quantidade de sacas. O preço é real, do dia, das mesmas fontes oficiais
          que o Safralume usa em tudo.
        </p>
      </Reveal>

      <Reveal delay={0.1} className="mx-auto mt-9 max-w-xl">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5 block text-xs font-semibold text-foreground">Cultura</Label>
              <Select
                value={cultura}
                onValueChange={(v) => {
                  setCultura(v);
                  reiniciar();
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Mais usadas</SelectLabel>
                    {culturasMaisUsadas.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Outras culturas</SelectLabel>
                    {culturasOutras.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-semibold text-foreground">
                Estado (UF)
              </Label>
              <Select
                value={uf}
                onValueChange={(v) => {
                  setUf(v);
                  reiniciar();
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {ufs.map((u) => (
                    <SelectItem key={u.value} value={u.value}>
                      {u.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4">
            <Label
              htmlFor="calc-landing-sacas"
              className="mb-1.5 block text-xs font-semibold text-foreground"
            >
              Quantidade (sacas de 60 kg)
            </Label>
            <Input
              id="calc-landing-sacas"
              inputMode="decimal"
              placeholder="Ex: 5.000"
              value={sacas}
              onChange={(e) => {
                setSacas(e.target.value);
                reiniciar();
              }}
            />
          </div>

          <button
            type="button"
            onClick={() => calcular()}
            disabled={calculando || !uf || !sacasValidas}
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-cta text-sm font-bold text-cta-foreground transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-cta/30 disabled:opacity-60"
          >
            {calculando ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Calculando...
              </>
            ) : (
              <>
                Calcular valor da safra
                <ArrowRight className="size-4" />
              </>
            )}
          </button>

          {erro && <p className="mt-3 text-center text-sm text-destructive">{erro}</p>}

          <AnimatePresence>
            {resultado && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="mt-6 border-t border-dashed border-border pt-6">
                  {!resultado.disponivel && resultado.outrasUfsDisponiveis.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground">
                      Ainda não temos preço recente dessa cultura em nenhum estado. Tenta outra
                      cultura, ou se cadastre — assim que sair um preço, você é avisado.
                    </p>
                  )}

                  {(!resultado.disponivel || escolhendoUf) &&
                    resultado.outrasUfsDisponiveis.length > 0 && (
                      <div className="flex flex-col gap-3">
                        <p className="text-center text-sm text-muted-foreground">
                          {resultado.disponivel
                            ? "Escolha o estado pra usar como referência:"
                            : `Ainda não tem preço em ${nomeDaUf(uf)}, mas tem dado real recente em outros estados:`}
                        </p>
                        <div className="flex flex-wrap justify-center gap-1.5">
                          {resultado.outrasUfsDisponiveis.map((o) => (
                            <button
                              key={o.uf}
                              type="button"
                              onClick={() => calcular(o.uf)}
                              className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors hover:border-primary hover:bg-primary/5 ${
                                o.uf === resultado.ufUsada
                                  ? "border-primary bg-primary/5 text-primary"
                                  : "border-border text-foreground"
                              }`}
                            >
                              {nomeDaUf(o.uf)} · {brl(o.preco)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                  {resultado.disponivel && !escolhendoUf && resultado.valorBruto != null && (
                    <>
                      {resultado.usandoOutraUf && (
                        <p className="mb-3 text-center text-xs text-muted-foreground">
                          Sem preço próprio em {nomeDaUf(uf)} ainda — usando{" "}
                          <strong>{nomeDaUf(resultado.ufUsada ?? "")}</strong> como referência (
                          {resultado.fonteFrase}).{" "}
                          {resultado.outrasUfsDisponiveis.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setEscolhendoUf(true)}
                              className="font-semibold text-primary underline underline-offset-2"
                            >
                              Trocar estado de referência
                            </button>
                          )}
                        </p>
                      )}
                      <p className="text-center text-[11px] font-semibold text-muted-foreground">
                        VALOR DA SUA PRODUÇÃO
                      </p>
                      <p className="text-center font-display text-3xl font-extrabold text-primary">
                        {brl(resultado.valorBruto)}
                      </p>
                      <p className="text-center text-xs text-muted-foreground">
                        {sacasNum.toLocaleString("pt-BR")} sacas × {brl(resultado.precoAtual!)}
                      </p>

                      {resultado.frete && (
                        <p className="mt-3 text-center text-xs text-muted-foreground">
                          {resultado.frete.frase}
                        </p>
                      )}

                      <a
                        href="#comece"
                        className="mt-5 flex items-center justify-center gap-1.5 text-sm font-bold text-primary hover:underline"
                      >
                        Quero acompanhar isso todos os dias
                        <ArrowRight className="size-3.5" />
                      </a>
                      <p className="mt-3 text-center text-xs text-muted-foreground">
                        Crie sua conta grátis por 7 dias e veja também sua margem, alertas
                        automáticos e a janela certa pra plantar. Sem cartão de crédito.
                      </p>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Reveal>
    </section>
  );
}
