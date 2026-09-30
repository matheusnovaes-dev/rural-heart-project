import { useEffect, useState } from "react";
import { Sprout } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";
import { CULTURA_PARA_CONAB_PROGRESSO } from "@/config/conabProgressoSafra";
import { ufs } from "@/config/ufs";
import type { Produtor } from "@/lib/auth";

type LinhaProgresso = {
  produto: string;
  tipo: string;
  uf: string;
  percentual: number;
  media_5_anos: number | null;
};

// Um grupo por produto+tipo (ex: "Milho 1ª"/semeadura e "Milho 2ª"/semeadura
// são grupos independentes, cada um com seu próprio estado selecionado).
type GrupoProgresso = {
  chave: string;
  produto: string;
  tipo: string;
  opcoes: LinhaProgresso[]; // só estados com percentual > 0, ordenado do maior pro menor
};

const formatarPct = (fracao: number) =>
  `${(fracao * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

const nomeDaUf = (uf: string) =>
  uf === "BR" ? "Brasil" : (ufs.find((u) => u.value === uf)?.label ?? uf);

/**
 * % de área semeada/colhida na semana mais recente (boletim "Plantio e
 * Colheita" da Conab, achado 2026-09-30) — mesmo dado que o bot já
 * responde no WhatsApp, direto no painel também. Consulta o client
 * `supabase` direto (a tabela é de leitura pública) igual o card de janela
 * de plantio ao lado.
 *
 * Achado ao vivo (print real, soja/MG): o estado do produtor pode estar
 * genuinamente em 0% (a cultura ainda não começou ali) — um número sozinho
 * nesse caso não diz nada útil. Em vez de só cair fixo no nacional, mostra
 * TODOS os estados que já têm avanço de verdade essa semana como opções
 * clicáveis (mesmo padrão de "trocar estado de referência" já usado na
 * calculadora de safra) — o produtor pode comparar com quem já começou.
 * Só aparece quando existe pelo menos UM estado (ou o Brasil) com
 * percentual > 0 pra essa cultura essa semana; fora da janela de
 * plantio/colheita, o card some.
 */
export function ProgressoSafraCard({ produtor }: { produtor: Produtor }) {
  const produtoConab = produtor.cultura_principal
    ? CULTURA_PARA_CONAB_PROGRESSO[produtor.cultura_principal.trim().toLowerCase()]
    : null;
  const [grupos, setGrupos] = useState<GrupoProgresso[] | null | undefined>(undefined);
  const [selecionado, setSelecionado] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!supabase || !produtoConab || !produtor.uf) return;
    let ativo = true;
    supabase
      .from("progresso_safra_conab")
      .select("produto, tipo, uf, semana_referencia, percentual, media_5_anos")
      .ilike("produto", `${produtoConab}%`)
      .order("semana_referencia", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        if (!ativo) return;
        if (!data || data.length === 0) {
          setGrupos(null);
          return;
        }
        const semanaMaisRecente = data[0]!.semana_referencia;
        const daSemana = data.filter(
          (l): l is LinhaProgresso & { semana_referencia: string } =>
            l.semana_referencia === semanaMaisRecente && l.percentual > 0,
        );

        const porChave = new Map<string, LinhaProgresso[]>();
        for (const linha of daSemana) {
          const chave = `${linha.produto}|${linha.tipo}`;
          if (!porChave.has(chave)) porChave.set(chave, []);
          porChave.get(chave)!.push(linha);
        }

        const gruposMontados: GrupoProgresso[] = [...porChave.entries()].map(([chave, opcoes]) => ({
          chave,
          produto: opcoes[0]!.produto,
          tipo: opcoes[0]!.tipo,
          opcoes: opcoes.sort((a, b) => b.percentual - a.percentual),
        }));

        setGrupos(gruposMontados.length > 0 ? gruposMontados : null);
        // Padrão: o estado do produtor, quando ele mesmo tem avanço > 0;
        // senão o Brasil (nacional) como base neutra — o produtor troca pra
        // qualquer outro estado clicando, sem precisar disso pronto.
        const padrao: Record<string, string> = {};
        for (const grupo of gruposMontados) {
          const temUf = grupo.opcoes.some((o) => o.uf === produtor.uf);
          padrao[grupo.chave] = temUf ? produtor.uf! : "BR";
        }
        setSelecionado(padrao);
      });
    return () => {
      ativo = false;
    };
  }, [produtoConab, produtor.uf]);

  if (!produtoConab || !produtor.uf) return null;
  if (grupos === null) return null;

  return (
    <Card className="gap-3 border-border/80 shadow-sm transition-shadow hover:shadow-md">
      <CardHeader className="border-b border-border/70 px-4 pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sprout className="size-4" />
          </span>
          Progresso da safra
        </CardTitle>
        <CardDescription>
          % de área semeada ou colhida essa semana, segundo a Conab.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        {grupos === undefined ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <div className="flex flex-col gap-4">
            {grupos.map((grupo) => {
              const ufAtual = selecionado[grupo.chave] ?? grupo.opcoes[0]!.uf;
              const linhaAtual = grupo.opcoes.find((o) => o.uf === ufAtual) ?? grupo.opcoes[0]!;
              const temUfPropria = grupo.opcoes.some((o) => o.uf === produtor.uf);
              return (
                <div key={grupo.chave} className="flex flex-col gap-2">
                  <p className="text-xs text-muted-foreground">
                    {grupo.produto} · {grupo.tipo === "semeadura" ? "semeadura" : "colheita"}
                    {!temUfPropria && ` — ${produtor.uf} sem avanço relevante ainda`}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {nomeDaUf(linhaAtual.uf)}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-sm font-semibold text-primary">
                      {formatarPct(linhaAtual.percentual)}
                    </span>
                    {linhaAtual.media_5_anos != null && (
                      <span className="text-xs text-muted-foreground">
                        média 5 anos: {formatarPct(linhaAtual.media_5_anos)}
                      </span>
                    )}
                  </div>
                  {grupo.opcoes.length > 1 && (
                    <div className="flex flex-wrap gap-1.5">
                      {grupo.opcoes.slice(0, 8).map((opcao) => (
                        <button
                          key={opcao.uf}
                          type="button"
                          onClick={() =>
                            setSelecionado((prev) => ({ ...prev, [grupo.chave]: opcao.uf }))
                          }
                          className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors hover:border-primary hover:bg-primary/5 ${
                            opcao.uf === ufAtual
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border text-muted-foreground"
                          }`}
                        >
                          {nomeDaUf(opcao.uf)} · {formatarPct(opcao.percentual)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <p className="text-xs text-muted-foreground">
              Fonte: Conab, boletim semanal "Plantio e Colheita".
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
