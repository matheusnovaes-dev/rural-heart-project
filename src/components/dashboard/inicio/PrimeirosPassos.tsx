import { Link } from "@tanstack/react-router";
import { Check, ChevronRight, MessageCircle, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { SafralumeIcon, type SafralumeIconeNome } from "@/components/icons/SafralumeIcon";
import { trackLanding } from "@/lib/metaPixel";
import { supabase } from "@/lib/supabase";
import { useAtualizarAoVoltar } from "@/lib/useAtualizarAoVoltar";

/**
 * "Primeiros passos": a trilha de ativação do Início (o critério dos prêmios de dashboard é orientar passo a passo, e
 * 85% de quem entra no teste nunca fala com o bot). Cada passo é marcado por dado real, não por clique:
 *  1. conversou com o bot no WhatsApp (checagem do servidor, vem do pai)
 *  2. tem um aviso ativo (preço, clima, câmbio ou leilão; criado no painel ou pelo bot)
 *  3. anotou algo no Caderno da fazenda (rascunho não conta)
 *  4. ligou o resumo do dia
 * Passo feito fica feito (o aparelho lembra), e com os 4 feitos o cartão some para sempre. Substitui o antigo convite
 * "Falta 1 passo" mantendo o mesmo botão, o mesmo texto da pergunta e os mesmos eventos de ativação.
 */

type Passo = "whatsapp" | "alerta" | "caderno" | "resumo";
type Feitos = Record<Exclude<Passo, "whatsapp">, boolean>;

const PASSOS: {
  id: Passo;
  icone: SafralumeIconeNome;
  titulo: string;
  /** Rótulo de 1 ou 2 palavras para o botão compacto do celular. */
  curto: string;
  texto: string;
  acao: string;
}[] = [
  {
    id: "whatsapp",
    icone: "whatsapp",
    titulo: "Peça seu primeiro preço no WhatsApp",
    curto: "WhatsApp",
    texto:
      "O Safralume funciona no WhatsApp: toque no botão e mande a pergunta que já vai escrita. O preço da sua região chega em segundos.",
    acao: "Ver meu preço no WhatsApp",
  },
  {
    id: "alerta",
    icone: "alerta",
    titulo: "Crie um aviso de preço",
    curto: "Aviso de preço",
    texto: "Escolha um valor e receba um aviso no WhatsApp quando o preço chegar lá.",
    acao: "Criar aviso",
  },
  {
    id: "caderno",
    icone: "relatorio",
    titulo: "Anote um gasto ou uma venda",
    curto: "Caderno",
    texto:
      'No Caderno da fazenda ou direto no WhatsApp ("gastei 2 mil de adubo"), pra ver o custo por saca e a margem.',
    acao: "Abrir o Caderno",
  },
  {
    id: "resumo",
    icone: "boletim",
    titulo: "Ligue o resumo do dia",
    curto: "Resumo do dia",
    texto:
      "Todo dia, no horário que você escolher, o preço e o clima chegam resumidos no WhatsApp.",
    acao: "Ligar o resumo",
  },
];

const chave = (produtorId: string, sufixo: string) => `safralume_passos_${sufixo}_${produtorId}`;

function ler(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function gravar(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {
    // sem armazenamento: só não lembra na próxima visita
  }
}

/** Já terminou (ou dispensou depois de falar com o bot)? Lido antes de montar, para a tela nascer sem reservar espaço. */
export function primeirosPassosEncerrados(produtorId: string): boolean {
  return ler(chave(produtorId, "fim")) === "1";
}

async function consultarFeitos(produtorId: string): Promise<Feitos | null> {
  if (!supabase) return null;
  const contar = (tabela: string) =>
    supabase!
      .from(tabela)
      .select("id", { count: "exact", head: true })
      .eq("produtor_id", produtorId)
      .eq("ativo", true);
  const [preco, clima, cambio, leilao, caderno, produtor] = await Promise.all([
    contar("alertas_preco"),
    contar("alertas_clima"),
    contar("alertas_cambio"),
    contar("alertas_leilao"),
    supabase
      .from("fazenda_registros")
      .select("id", { count: "exact", head: true })
      .eq("produtor_id", produtorId)
      .neq("situacao", "rascunho"),
    supabase.from("produtores").select("resumo_diario_ativo").eq("id", produtorId).maybeSingle(),
  ]);
  // Erro em qualquer consulta: melhor não marcar nada do que marcar errado.
  if (preco.error || caderno.error || produtor.error) return null;
  return {
    alerta: (preco.count ?? 0) + (clima.count ?? 0) + (cambio.count ?? 0) + (leilao.count ?? 0) > 0,
    caderno: (caderno.count ?? 0) > 0,
    resumo: !!(produtor.data as { resumo_diario_ativo?: boolean } | null)?.resumo_diario_ativo,
  };
}

export function PrimeirosPassos({
  produtorId,
  jaConversou,
  whatsappHref,
  onDispensarSessao,
  onEncerrado,
}: {
  produtorId: string;
  /** null = checagem do servidor ainda em andamento. */
  jaConversou: boolean | null;
  whatsappHref: string;
  /** Sem a 1ª conversa, o X só esconde nesta visita (o convite do WhatsApp é o produto de verdade). */
  onDispensarSessao: () => void;
  /** Terminou ou foi dispensado de vez: o pai tira o espaço do cartão. */
  onEncerrado?: () => void;
}) {
  // O que o aparelho já sabe que foi feito (passo feito não "desfaz": apagar o aviso depois não volta a trilha).
  const [feitos, setFeitos] = useState<Feitos | null>(() => {
    const salvo = ler(chave(produtorId, "feitos"));
    if (!salvo) return null;
    try {
      return JSON.parse(salvo) as Feitos;
    } catch {
      return null;
    }
  });
  const [encerrado, setEncerrado] = useState(() => primeirosPassosEncerrados(produtorId));

  const atualizar = useCallback(() => {
    consultarFeitos(produtorId)
      .then((novo) => {
        if (!novo) return;
        setFeitos((antes) => {
          const junto: Feitos = {
            alerta: novo.alerta || !!antes?.alerta,
            caderno: novo.caderno || !!antes?.caderno,
            resumo: novo.resumo || !!antes?.resumo,
          };
          gravar(chave(produtorId, "feitos"), JSON.stringify(junto));
          return antes &&
            antes.alerta === junto.alerta &&
            antes.caderno === junto.caderno &&
            antes.resumo === junto.resumo
            ? antes
            : junto;
        });
      })
      .catch(() => {
        // sem rede: fica com o que já sabia
      });
  }, [produtorId]);

  useEffect(() => {
    if (!encerrado) atualizar();
  }, [atualizar, encerrado]);
  // Voltou do WhatsApp ou de outra tela: confere de novo (só com a aba visível, sem esqueleto).
  useAtualizarAoVoltar(() => !encerrado && atualizar(), { intervaloMs: 120_000, minimoMs: 8_000 });

  const estado: Record<Passo, boolean | null> = {
    whatsapp: jaConversou,
    alerta: feitos?.alerta ?? null,
    caderno: feitos?.caderno ?? null,
    resumo: feitos?.resumo ?? null,
  };
  const conhecido = Object.values(estado).every((v) => v !== null);
  const totalFeitos = Object.values(estado).filter((v) => v === true).length;
  const tudoFeito = conhecido && totalFeitos === PASSOS.length;

  useEffect(() => {
    if (tudoFeito) {
      gravar(chave(produtorId, "fim"), "1");
      setEncerrado(true);
    }
  }, [tudoFeito, produtorId]);

  const avisar = useRef(onEncerrado);
  avisar.current = onEncerrado;
  useEffect(() => {
    if (encerrado) avisar.current?.();
  }, [encerrado]);

  const contou = useRef(false);
  useEffect(() => {
    if (!conhecido || tudoFeito || encerrado || contou.current) return;
    contou.current = true;
    trackLanding("PrimeirosPassosVisto", { feitos: totalFeitos });
  }, [conhecido, tudoFeito, encerrado, totalFeitos]);

  if (encerrado || tudoFeito) return null;

  // Enquanto não sabe tudo, reserva o lugar com a altura do cartão (sem isso o preço desce depois: pulo de layout).
  if (!conhecido) {
    // Quem já conversou pode ter feito tudo: reservar e depois recolher seria um pulo grande (medido: 0,65 no celular).
    // Só quem ainda não conversou tem o cartão garantido (o passo 1 está pendente), então só aí o espaço é reservado.
    if (jaConversou === true) return null;
    return (
      <div
        aria-hidden="true"
        data-testid="primeiros-passos-espera"
        className="min-h-[26rem] animate-pulse rounded-2xl border border-primary/15 bg-primary/5 max-[359px]:min-h-[29.5rem] sm:min-h-[19rem]"
      />
    );
  }

  const atual = PASSOS.find((p) => !estado[p.id])!;

  function dispensar() {
    trackLanding("PrimeirosPassosDispensado", { feitos: totalFeitos });
    if (!estado.whatsapp) {
      onDispensarSessao();
      return;
    }
    gravar(chave(produtorId, "fim"), "1");
    setEncerrado(true);
  }

  function aoClicar(passo: Passo) {
    trackLanding("PrimeirosPassosClique", { passo });
    if (passo === "whatsapp") trackLanding("AtivacaoWhatsappClique", { origem: "painel" });
  }

  return (
    <section
      aria-labelledby="primeiros-passos-titulo"
      data-testid="primeiros-passos"
      className="card-premium relative overflow-hidden rounded-2xl border border-primary/25 bg-card p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
            Primeiros passos
          </p>
          <h2
            id="primeiros-passos-titulo"
            className="mt-1 font-display text-lg leading-snug font-semibold tracking-tight text-foreground text-balance sm:text-xl"
          >
            {totalFeitos === 0
              ? "Deixe o Safralume trabalhando pra você"
              : PASSOS.length - totalFeitos === 1
                ? "Falta 1 passo pra aproveitar tudo"
                : `Faltam ${PASSOS.length - totalFeitos} passos pra aproveitar tudo`}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="font-mono text-sm font-semibold text-muted-foreground tabular-nums">
            {totalFeitos}/{PASSOS.length}
          </span>
          <button
            type="button"
            onClick={dispensar}
            aria-label="Dispensar primeiros passos"
            className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground pointer-coarse:size-11"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div
        className="mt-3 grid grid-cols-4 gap-1.5"
        role="progressbar"
        aria-label="Progresso dos primeiros passos"
        aria-valuemin={0}
        aria-valuemax={PASSOS.length}
        aria-valuenow={totalFeitos}
      >
        {PASSOS.map((p) => (
          <span
            key={p.id}
            className={`h-1.5 rounded-full transition-colors duration-500 ${estado[p.id] ? "bg-primary" : p.id === atual.id ? "bg-cta/70" : "bg-secondary"}`}
          />
        ))}
      </div>

      <ol className="mt-4 flex flex-col gap-2 lg:grid lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-3">
        {/* Passo da vez, em destaque */}
        <li className="rounded-xl border border-cta/35 bg-cta/[0.07] p-3 sm:p-4 lg:row-span-3">
          <div className="flex items-start gap-3">
            <SafralumeIcon nome={atual.icone} className="size-8 shrink-0 sm:size-9" />
            <div className="min-w-0">
              <p className="text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase max-sm:hidden">
                Passo {PASSOS.indexOf(atual) + 1} de {PASSOS.length}
              </p>
              <p className="text-base leading-snug font-semibold text-foreground">{atual.titulo}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{atual.texto}</p>
            </div>
          </div>
          <BotaoDoPasso
            passo={atual}
            whatsappHref={whatsappHref}
            onClick={() => aoClicar(atual.id)}
            variante="destaque"
          />
        </li>

        {/* Os outros três: linhas a partir do tablet, três botões lado a lado no celular (cartão baixo, preço à vista) */}
        {PASSOS.filter((p) => p.id !== atual.id).map((p) => {
          const feito = !!estado[p.id];
          return (
            <li key={p.id} className="max-sm:hidden">
              {feito ? (
                <div className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground">
                  <Feito />
                  <span className="min-w-0 flex-1 truncate">{p.titulo}</span>
                  <span className="sr-only">feito</span>
                </div>
              ) : (
                <BotaoDoPasso
                  passo={p}
                  whatsappHref={whatsappHref}
                  onClick={() => aoClicar(p.id)}
                  variante="linha"
                  numero={PASSOS.indexOf(p) + 1}
                />
              )}
            </li>
          );
        })}
        <li className="grid grid-cols-3 gap-2 sm:hidden">
          {PASSOS.filter((p) => p.id !== atual.id).map((p) =>
            estado[p.id] ? (
              <div
                key={p.id}
                className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-center text-xs leading-tight text-muted-foreground"
              >
                <Feito />
                {p.curto}
                <span className="sr-only">feito</span>
              </div>
            ) : (
              <BotaoDoPasso
                key={p.id}
                passo={p}
                whatsappHref={whatsappHref}
                onClick={() => aoClicar(p.id)}
                variante="pilula"
                numero={PASSOS.indexOf(p) + 1}
              />
            ),
          )}
        </li>
      </ol>
    </section>
  );
}

function Feito() {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
      <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
    </span>
  );
}

function BotaoDoPasso({
  passo,
  whatsappHref,
  onClick,
  variante,
  numero,
}: {
  passo: (typeof PASSOS)[number];
  whatsappHref: string;
  onClick: () => void;
  variante: "destaque" | "linha" | "pilula";
  numero?: number;
}) {
  const destaque = variante === "destaque";
  const classe = destaque
    ? "mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-cta px-4 text-[15px] font-bold whitespace-nowrap text-cta-foreground shadow-sm transition hover:bg-cta/90 sm:w-auto sm:px-5 sm:text-base"
    : variante === "pilula"
      ? "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border border-border bg-card px-1 py-1.5 text-center text-xs leading-tight font-medium text-foreground transition active:bg-secondary/60"
      : "group flex min-h-11 w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 text-left text-sm font-medium text-foreground transition hover:border-primary/40 hover:bg-secondary/60";
  const conteudo = destaque ? (
    <>
      {passo.id === "whatsapp" && <MessageCircle className="size-5" aria-hidden="true" />}
      {passo.acao}
      {passo.id !== "whatsapp" && <ChevronRight className="size-4" aria-hidden="true" />}
    </>
  ) : variante === "pilula" ? (
    <>
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border font-mono text-xs text-muted-foreground">
        {numero}
      </span>
      {passo.curto}
    </>
  ) : (
    <>
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border font-mono text-xs text-muted-foreground">
        {numero}
      </span>
      <span className="min-w-0 flex-1 truncate">{passo.titulo}</span>
      <ChevronRight
        className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </>
  );

  if (passo.id === "whatsapp") {
    return (
      <a
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        className={classe}
      >
        {conteudo}
      </a>
    );
  }
  if (passo.id === "alerta") {
    return (
      <Link
        to="/dashboard/alertas"
        search={{ abrir: "preco" }}
        onClick={onClick}
        className={classe}
      >
        {conteudo}
      </Link>
    );
  }
  return (
    <Link
      to={passo.id === "caderno" ? "/dashboard/fazenda" : "/dashboard/perfil"}
      onClick={onClick}
      className={classe}
    >
      {conteudo}
    </Link>
  );
}
