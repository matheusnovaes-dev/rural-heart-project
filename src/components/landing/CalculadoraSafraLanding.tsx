import { TituloDuasVozes } from "@/components/landing/TituloDuasVozes";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Calculator, ChevronDown, Loader2 } from "lucide-react";

import { AnimatedNumber } from "@/components/dashboard/AnimatedNumber";
import { CampoWhatsappCta } from "@/components/landing/CampoWhatsappCta";
import { useCadastro } from "@/components/landing/CadastroProvider";
import { trackLanding } from "@/lib/metaPixel";
import { Reveal } from "@/components/landing/Reveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
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
import type { ResultadoFrete } from "@/lib/paridade";

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
const ATALHOS_SACAS = [500, 1000, 5000, 10000];
const formatarSacas = (n: number) => n.toLocaleString("pt-BR");

export function CalculadoraSafraLanding() {
  const { abrirCadastro } = useCadastro();
  const reduzMovimento = useReducedMotion();
  const [cultura, setCultura] = useState("soja");
  const [uf, setUf] = useState("");
  const [sacas, setSacas] = useState("");
  const [calculando, setCalculando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoCalculadora | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // Só mostra "faltou X" depois da primeira tentativa de calcular: antes
  // disso o botão ficava esmaecido (parecia desabilitado) e a pessoa não
  // sabia o que faltava. Agora ele é sempre clicável e diz o que falta.
  const [tentou, setTentou] = useState(false);
  // Separado do resultado calculado de propósito: o cálculo já escolhe a UF
  // de referência mais recente sozinho, então "trocar" só reabre a lista
  // (sem isso, "trocar" recalcularia e cairia de volta na mesma escolha).
  const [escolhendoUf, setEscolhendoUf] = useState(false);
  const resultadoRef = useRef<HTMLDivElement>(null);
  // Cada cálculo recebe um número; só o mais recente pode aparecer. Sem isso,
  // tocar "500" e "10.000" rápido deixava a resposta mais lenta (a antiga)
  // sobrescrever a nova. `consulta` guarda o que o servidor de fato usou, pra
  // a linha "N sacas × preço" nunca divergir do total mostrado.
  const idRequisicao = useRef(0);
  const [consulta, setConsulta] = useState<{ sacas: number; uf: string } | null>(null);

  const sacasNum = Number(sacas.replace(/\./g, "").replace(",", "."));
  const sacasValidas = sacas.trim() !== "" && Number.isFinite(sacasNum) && sacasNum > 0;
  const culturaLabel = culturas.find((c) => c.value === cultura)?.label ?? cultura;

  async function calcular(sobrescrever?: { uf?: string; sacas?: string; ufReferencia?: string }) {
    const ufUsada = sobrescrever?.uf ?? uf;
    const sacasTexto = sobrescrever?.sacas ?? sacas;
    const n = Number(sacasTexto.replace(/\./g, "").replace(",", "."));
    const valido = sacasTexto.trim() !== "" && Number.isFinite(n) && n > 0;
    setTentou(true);
    if (!ufUsada || !valido) return;
    const meuId = ++idRequisicao.current;
    setCalculando(true);
    setErro(null);
    setEscolhendoUf(false);
    try {
      const r = await calcularValorProducaoPublico({
        data: {
          cultura,
          uf: ufUsada,
          sacas: n,
          ufReferencia: sobrescrever?.ufReferencia ?? null,
        },
      });
      if (meuId !== idRequisicao.current) return;
      setConsulta({ sacas: n, uf: ufUsada });
      setResultado(r);
      trackLanding("CalculadoraUsada", { cultura, uf: ufUsada, comPreco: r.disponivel });
    } catch {
      if (meuId !== idRequisicao.current) return;
      setErro("Não consegui calcular agora. Tenta de novo em instantes.");
      setResultado(null);
    } finally {
      if (meuId === idRequisicao.current) setCalculando(false);
    }
  }

  function reiniciar() {
    // Mudou algo no formulário: qualquer resposta ainda em voo fica obsoleta.
    idRequisicao.current++;
    setCalculando(false);
    setResultado(null);
    setErro(null);
    setEscolhendoUf(false);
  }

  // No celular o resultado nasce abaixo do botão, às vezes fora da tela: leva
  // o olhar até ele em vez de a pessoa achar que nada aconteceu.
  useEffect(() => {
    if (!resultado) return;
    const el = resultadoRef.current;
    if (!el) return;
    const topo = el.getBoundingClientRect().top;
    if (topo > window.innerHeight * 0.6) {
      window.scrollBy({ top: topo - 96, behavior: reduzMovimento ? "auto" : "smooth" });
    }
  }, [resultado, reduzMovimento]);

  const faltaUf = tentou && !uf;
  const faltaSacas = tentou && !sacasValidas;

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:py-20 sm:px-6">
      <Reveal className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3.5 py-1.5 text-xs font-semibold text-primary">
          <Calculator className="size-3.5" aria-hidden="true" />
          Uma das ferramentas do Safralume
        </span>
        <TituloDuasVozes
          antes="Quanto sua produção"
          serifa="VALE HOJE?"
          className="mt-4 text-foreground"
        />
        <p className="mt-2.5 text-muted-foreground">
          Essa é a Calculadora de Safra, uma amostra do que o Safralume faz. Cultura, estado e
          quantidade de sacas. O preço é real, do dia, das mesmas fontes oficiais que usamos em
          tudo.
        </p>
        <p className="mt-1.5 text-sm font-semibold text-primary">
          O produto completo tem muito mais: preço comparado com o porto e o frete, sinal de venda,
          previsão do tempo, alertas automáticos, janela de plantio e histórico de safra da Conab,
          no painel ou direto pelo WhatsApp.
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
                <SelectTrigger className="w-full" aria-label="Cultura">
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
              <Label className="mb-1.5 block text-xs font-semibold text-foreground">Estado</Label>
              <Select
                value={uf}
                onValueChange={(v) => {
                  setUf(v);
                  reiniciar();
                  // Cultura, estado e sacas completos: calcula na hora, sem
                  // exigir mais um toque no botão.
                  if (sacasValidas) void calcular({ uf: v });
                }}
              >
                <SelectTrigger
                  aria-label="Estado onde você produz"
                  className={`w-full ${faltaUf ? "border-destructive" : ""}`}
                  aria-invalid={faltaUf || undefined}
                  aria-describedby={faltaUf ? "calc-landing-uf-erro" : undefined}
                >
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
              {faltaUf && (
                <p
                  id="calc-landing-uf-erro"
                  role="alert"
                  className="mt-1.5 text-xs font-medium text-destructive"
                >
                  Selecione o seu estado.
                </p>
              )}
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
              name="sacas"
              inputMode="numeric"
              autoComplete="off"
              placeholder="Ex: 5.000"
              value={sacas}
              aria-invalid={faltaSacas || undefined}
              aria-describedby={faltaSacas ? "calc-landing-sacas-erro" : undefined}
              className={faltaSacas ? "border-destructive" : undefined}
              onChange={(e) => {
                setSacas(e.target.value);
                reiniciar();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void calcular();
                }
              }}
            />
            {faltaSacas && (
              <p
                id="calc-landing-sacas-erro"
                role="alert"
                className="mt-1.5 text-xs font-medium text-destructive"
              >
                Digite quantas sacas você tem (ou toque em uma sugestão).
              </p>
            )}
            <div
              className="mt-2.5 flex flex-wrap items-center gap-1.5"
              aria-label="Sugestões de quantidade"
            >
              {ATALHOS_SACAS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    const texto = formatarSacas(n);
                    setSacas(texto);
                    reiniciar();
                    if (uf) void calcular({ sacas: texto });
                  }}
                  className="touch-manipulation rounded-full border border-border bg-background px-3.5 py-2 text-sm font-semibold pointer-coarse:min-h-11 text-foreground transition-colors hover:border-primary hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none active:scale-[0.97]"
                >
                  {formatarSacas(n)} sacas
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => void calcular()}
            disabled={calculando}
            className="mt-6 flex h-12 w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-cta text-sm font-bold text-cta-foreground shadow-md shadow-cta/20 transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-cta/30 focus-visible:ring-4 focus-visible:ring-cta/40 focus-visible:outline-none active:translate-y-0 active:scale-[0.98] disabled:cursor-wait disabled:opacity-80 motion-reduce:transition-none"
          >
            {calculando ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Calculando…
              </>
            ) : (
              <>
                Calcular valor da safra
                <ArrowRight className="size-4" aria-hidden="true" />
              </>
            )}
          </button>

          {erro && (
            <p role="alert" className="mt-3 text-center text-sm text-destructive">
              {erro}
            </p>
          )}

          <AnimatePresence>
            {resultado && (
              <motion.div
                ref={resultadoRef}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="mt-6 border-t border-dashed border-border pt-6">
                  {!resultado.disponivel && resultado.outrasUfsDisponiveis.length === 0 && (
                    <>
                      <p className="text-center text-sm text-muted-foreground">
                        Ainda não temos preço recente dessa cultura em nenhum estado. Tenta outra
                        cultura, ou deixe seu WhatsApp: assim que sair um preço, você é avisado.
                      </p>
                      <PainelCaptura
                        titulo="Avise-me quando sair o preço"
                        texto={`Assim que houver cotação de ${culturaLabel.toLowerCase()}, você recebe no WhatsApp.`}
                        aoEnviar={(whatsapp) =>
                          abrirCadastro({ whatsapp, cultura, uf, origem: "calculadora" })
                        }
                      />
                    </>
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
                              onClick={() => void calcular({ ufReferencia: o.uf })}
                              className={`touch-manipulation rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors hover:border-primary hover:bg-primary/5 ${
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
                          Sem preço próprio em {nomeDaUf(uf)} ainda, usando{" "}
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
                      <p className="text-center text-xs font-semibold text-muted-foreground">
                        VALOR DA SUA PRODUÇÃO
                      </p>
                      <p className="text-center font-display text-4xl font-extrabold text-primary tabular-nums">
                        {reduzMovimento ? (
                          brl(resultado.valorBruto)
                        ) : (
                          <span aria-hidden="true">
                            R$ <AnimatedNumber value={resultado.valorBruto} />
                          </span>
                        )}
                      </p>
                      {/* O número sobe animado (muda ~50x em 0,9s): lido direto,
                          o leitor de tela soletraria valores parciais. Aqui vai
                          só o valor final, uma vez. */}
                      <p role="status" className="sr-only">
                        Valor da sua produção: {brl(resultado.valorBruto)}
                      </p>
                      <p className="text-center text-xs text-muted-foreground">
                        {(consulta?.sacas ?? sacasNum).toLocaleString("pt-BR")} sacas ×{" "}
                        {brl(resultado.precoAtual!)}
                      </p>

                      {resultado.frete?.tipo === "paridade" && (
                        <SimuladorFrete freteReal={resultado.frete} />
                      )}
                      {resultado.frete?.tipo === "frete_referencia" && (
                        <p className="mt-3 text-center text-xs text-muted-foreground">
                          {resultado.frete.frase}
                        </p>
                      )}

                      {/* Momento de maior intenção da página: a pessoa acabou de
                          ver o valor da própria safra. O CTA fica aqui, com o
                          número já digitável, e leva cultura e estado já
                          escolhidos pro cadastro (antes era um link que
                          rolava ~10 mil px até o rodapé). */}
                      <PainelCaptura
                        titulo="Acompanhe esse preço direto no seu WhatsApp"
                        texto={
                          // Sem preço próprio no estado escolhido (resultado veio de um
                          // estado de referência): não prometer "preço em <estado>".
                          resultado.usandoOutraUf
                            ? `Preço de ${culturaLabel.toLowerCase()}, o do porto com frete e um aviso quando for a hora de vender.`
                            : `Preço de ${culturaLabel.toLowerCase()} em ${nomeDaUf(consulta?.uf ?? uf)}, o do porto com frete e um aviso quando for a hora de vender.`
                        }
                        aoEnviar={(whatsapp) =>
                          abrirCadastro({
                            whatsapp,
                            cultura,
                            uf: consulta?.uf ?? uf,
                            origem: "calculadora",
                          })
                        }
                      />
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Reveal>

      <Reveal
        delay={0.2}
        className="mx-auto mt-10 flex max-w-xl flex-col items-center gap-2 text-center"
      >
        <a
          href="#como-funciona"
          className="flex flex-col items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-primary"
        >
          <span>
            Confira mais do que o Safralume oferece: sua ferramenta de inteligência agrícola
          </span>
          <ChevronDown
            className="size-5 animate-bounce motion-reduce:animate-none"
            aria-hidden="true"
          />
        </a>
      </Reveal>
    </section>
  );
}

/** Painel de captura de WhatsApp dentro do resultado da calculadora. */
function PainelCaptura({
  titulo,
  texto,
  aoEnviar,
}: {
  titulo: string;
  texto: string;
  aoEnviar: (whatsapp: string) => void;
}) {
  const { setCtaInlineVisivel } = useCadastro();
  const raizRef = useRef<HTMLDivElement>(null);
  // Enquanto este painel está na tela, a barra de CTA fixa (celular) se
  // esconde: seriam dois convites idênticos empilhados.
  useEffect(() => {
    const el = raizRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setCtaInlineVisivel(!!e?.isIntersecting));
    io.observe(el);
    return () => {
      io.disconnect();
      setCtaInlineVisivel(false);
    };
  }, [setCtaInlineVisivel]);

  return (
    <div ref={raizRef} className="mt-6 rounded-2xl bg-primary p-5 text-primary-foreground sm:p-6">
      <p className="text-balance font-display text-xl leading-snug font-bold">{titulo}</p>
      <p className="mt-1.5 text-sm text-primary-foreground/80">{texto}</p>
      <CampoWhatsappCta variante="escuro" aoEnviar={aoEnviar} className="mt-4" />
      <p className="mt-3 text-center text-xs text-balance text-primary-foreground/75">
        7 dias grátis · Sem cartão · Cancele quando quiser
      </p>
    </div>
  );
}

/**
 * Pedido do Matheus 2026-10-08 (baseado em referência de SaaS premiado): a
 * mesma frase estática do frete virou um slider de verdade. O preço do porto
 * e o frete real da rota (origem → porto, tabela `fretes`) já vêm calculados
 * do servidor; o slider só deixa a pessoa EXPLORAR em cima desse número real
 * em vez de só ler ele — por padrão começa exatamente no frete real, pra não
 * parecer um valor inventado.
 */
function SimuladorFrete({
  freteReal,
}: {
  freteReal: Extract<ResultadoFrete, { tipo: "paridade" }>;
}) {
  const freteRealArredondado = Math.round(freteReal.frete_por_saca * 100) / 100;
  const maxFrete = Math.max(10, Math.ceil(freteRealArredondado * 2.5));
  const [frete, setFrete] = useState(freteRealArredondado);

  // Troca de cultura/UF/sacas recalcula o resultado: resincroniza o slider
  // com o novo frete real em vez de carregar o valor explorado da combinação
  // anterior.
  useEffect(() => {
    setFrete(freteRealArredondado);
  }, [freteRealArredondado]);

  const precoLiquido = Math.max(0, freteReal.preco_porto - frete);
  const noValorReal = Math.abs(frete - freteRealArredondado) < 0.01;

  return (
    <div className="mt-4 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4">
      <p className="text-center text-xs font-semibold uppercase tracking-wide text-primary">
        Arraste e veja o que o frete faz no seu preço
      </p>

      <div className="mt-3 flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span>Porto paga {brl(freteReal.preco_porto)}</span>
        <span>Frete: {brl(frete)}/saca</span>
      </div>
      <Slider
        value={[frete]}
        onValueChange={([v]) => setFrete(v ?? freteRealArredondado)}
        min={0}
        max={maxFrete}
        step={0.5}
        className="mt-2.5"
        aria-label="Simular frete por saca"
      />

      <p className="mt-3 text-center text-sm text-muted-foreground">
        Seu preço líquido:{" "}
        <span className="font-display text-lg font-bold text-primary">{brl(precoLiquido)}</span>
      </p>
      <p className="mt-1 text-center text-xs text-muted-foreground">
        {noValorReal ? (
          <>
            Esse é o frete real de {freteReal.rota.municipio_origem} até{" "}
            {freteReal.rota.municipio_destino}.
          </>
        ) : (
          <button
            type="button"
            onClick={() => setFrete(freteRealArredondado)}
            className="font-semibold text-primary underline underline-offset-2"
          >
            Voltar pro frete real da sua rota
          </button>
        )}
      </p>
    </div>
  );
}
