import { useEffect, useState } from "react";
import { Sprout } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";
import { CULTURA_PARA_CONAB_PROGRESSO } from "@/config/conabProgressoSafra";
import type { Produtor } from "@/lib/auth";

type LinhaProgresso = {
  produto: string;
  tipo: string;
  uf: string;
  percentual: number;
  media_5_anos: number | null;
};

const formatarPct = (fracao: number) =>
  `${(fracao * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/**
 * % de área semeada/colhida na semana mais recente (boletim "Plantio e
 * Colheita" da Conab, achado 2026-09-30) — mesmo dado que o bot já
 * responde no WhatsApp, direto no painel também. Consulta o client
 * `supabase` direto (a tabela é de leitura pública, sem precisar de
 * service role) igual o card de janela de plantio ao lado. Só aparece
 * quando a cultura do produtor está na janela de plantio/colheita
 * daquela semana — fora dessa época, o card some (nada pra mostrar é
 * melhor do que mostrar um "0%" que parece erro).
 */
export function ProgressoSafraCard({ produtor }: { produtor: Produtor }) {
  const produtoConab = produtor.cultura_principal
    ? CULTURA_PARA_CONAB_PROGRESSO[produtor.cultura_principal.trim().toLowerCase()]
    : null;
  const [linhas, setLinhas] = useState<LinhaProgresso[] | null | undefined>(undefined);

  useEffect(() => {
    if (!supabase || !produtoConab || !produtor.uf) return;
    let ativo = true;
    supabase
      .from("progresso_safra_conab")
      .select("produto, tipo, uf, semana_referencia, percentual, media_5_anos")
      .ilike("produto", `${produtoConab}%`)
      .in("uf", [produtor.uf, "BR"])
      .order("semana_referencia", { ascending: false })
      .limit(12)
      .then(({ data }) => {
        if (!ativo) return;
        if (!data || data.length === 0) {
          setLinhas(null);
          return;
        }
        const semanaMaisRecente = data[0]!.semana_referencia;
        // 0% é dado real (a cultura genuinamente ainda não começou nesse
        // estado ou no Brasil), mas sozinho não diz nada útil pro produtor —
        // achado ao vivo: MG em soja deu "0% · média 5 anos: 0%", um card
        // que não mostra nada de interessante. Descarta ANTES de escolher
        // UF vs. nacional, pra um MG=0% não esconder um Brasil=3,9% que
        // seria útil de mostrar.
        const daSemanaComDado = data.filter(
          (l) => l.semana_referencia === semanaMaisRecente && l.percentual > 0,
        );
        // Por produto+tipo (ex: "Milho 1ª"/semeadura), prefere a linha da UF
        // do produtor; só usa a nacional ("BR") quando ela não tem (ou tem
        // zero) — nunca mostra as duas juntas (achado testando: mostrar as
        // duas fazia o aviso "sem dado específico do estado" aparecer do
        // lado de um número que ERA específico do estado).
        const porGrupo = new Map<string, (typeof daSemanaComDado)[number]>();
        for (const linha of daSemanaComDado) {
          const chave = `${linha.produto}|${linha.tipo}`;
          const existente = porGrupo.get(chave);
          if (!existente || linha.uf === produtor.uf) {
            if (!existente || existente.uf !== produtor.uf) porGrupo.set(chave, linha);
          }
        }
        const linhasFinais = [...porGrupo.values()];
        setLinhas(linhasFinais.length > 0 ? linhasFinais : null);
      });
    return () => {
      ativo = false;
    };
  }, [produtoConab, produtor.uf]);

  if (!produtoConab || !produtor.uf) return null;
  // Fora da janela de plantio/colheita dessa cultura essa semana: nada a
  // mostrar, o card não aparece (não é erro, só não tem novidade agora).
  if (linhas === null) return null;

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
        {linhas === undefined ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <div className="flex flex-col gap-3">
            {linhas.map((linha) => {
              const daUf = linha.uf === produtor.uf;
              return (
                <div
                  key={`${linha.produto}-${linha.tipo}-${linha.uf}`}
                  className="flex flex-col gap-1"
                >
                  <p className="text-xs text-muted-foreground">
                    {linha.produto} · {linha.tipo === "semeadura" ? "semeadura" : "colheita"}
                    {!daUf && ` (Brasil — ainda sem avanço relevante em ${produtor.uf})`}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-sm font-semibold text-primary">
                      {formatarPct(linha.percentual)}
                    </span>
                    {linha.media_5_anos != null && (
                      <span className="text-xs text-muted-foreground">
                        média 5 anos: {formatarPct(linha.media_5_anos)}
                      </span>
                    )}
                  </div>
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
