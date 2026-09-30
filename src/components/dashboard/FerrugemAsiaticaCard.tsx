import { useEffect, useState } from "react";
import { Bug } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";
import { normalizarCultura } from "@/config/culturas";
import type { Produtor } from "@/lib/auth";

type LinhaFerrugem = {
  safra: string;
  safra_id: number;
  municipio_nome: string;
  tipo: number;
  quantidade: number;
};

type ResultadoFerrugem = {
  safra: string;
  confirmadas: { municipio: string; quantidade: number }[];
  esporos: { municipio: string }[];
};

/**
 * Ferrugem asiática da soja, na UF do produtor — mesma fonte e mesma
 * lógica (tipo 1 = confirmada, 4 = esporo no ar) da tool buscar_ferrugem_
 * asiatica do bot, achada 2026-09-30. Só aparece pra quem planta soja —
 * pra outras culturas a ferramenta nem se aplica. Sem foco nem esporo é
 * uma notícia BOA (mostra mesmo assim, não esconde o card): o silêncio
 * sozinho não deixa claro se é "sem dado" ou "sem problema".
 */
export function FerrugemAsiaticaCard({ produtor }: { produtor: Produtor }) {
  const ehSoja = produtor.cultura_principal
    ? normalizarCultura(produtor.cultura_principal) === "soja"
    : false;
  const [resultado, setResultado] = useState<ResultadoFerrugem | null | undefined>(undefined);

  useEffect(() => {
    if (!supabase || !produtor.uf || !ehSoja) return;
    let ativo = true;
    supabase
      .from("ferrugem_asiatica_ocorrencias")
      .select("safra, safra_id, municipio_nome, tipo, quantidade")
      .eq("uf", produtor.uf)
      .order("safra_id", { ascending: false })
      .returns<LinhaFerrugem[]>()
      .then(({ data }) => {
        if (!ativo) return;
        if (!data || data.length === 0) {
          setResultado(null);
          return;
        }
        const safraMaisRecente = data[0]!.safra_id;
        const daSafra = data.filter((l) => l.safra_id === safraMaisRecente);
        const confirmadas = daSafra
          .filter((l) => l.tipo === 1 && l.quantidade > 0)
          .map((l) => ({ municipio: l.municipio_nome, quantidade: l.quantidade }))
          .sort((a, b) => b.quantidade - a.quantidade);
        const esporos = daSafra
          .filter((l) => l.tipo === 4 && l.quantidade > 0)
          .map((l) => ({ municipio: l.municipio_nome }));
        setResultado({ safra: daSafra[0]!.safra, confirmadas, esporos });
      });
    return () => {
      ativo = false;
    };
  }, [produtor.uf, ehSoja]);

  if (!ehSoja || !produtor.uf) return null;
  if (resultado === null) return null;

  const temFoco = resultado !== undefined && resultado.confirmadas.length > 0;
  const temEsporo = resultado !== undefined && resultado.esporos.length > 0;

  return (
    <Card
      className={`gap-3 shadow-sm transition-shadow hover:shadow-md ${
        temFoco ? "border-destructive/40" : temEsporo ? "border-cta/40" : "border-border/80"
      }`}
    >
      <CardHeader className="border-b border-border/70 px-4 pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <span
            className={`flex size-8 items-center justify-center rounded-lg ${
              temFoco
                ? "bg-destructive/10 text-destructive"
                : temEsporo
                  ? "bg-cta/10 text-cta-foreground"
                  : "bg-primary/10 text-primary"
            }`}
          >
            <Bug className="size-4" />
          </span>
          Ferrugem asiática
        </CardTitle>
        <CardDescription>Ocorrências na safra, segundo o Consórcio Antiferrugem.</CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        {resultado === undefined ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              Safra {resultado.safra} · {produtor.uf}
            </p>

            {!temFoco && !temEsporo && (
              <p className="text-sm text-foreground">
                Nenhum foco confirmado nem esporo detectado no seu estado até agora nessa safra.
              </p>
            )}

            {temFoco && (
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-semibold text-destructive">Focos confirmados</p>
                <div className="flex flex-wrap gap-1.5">
                  {resultado!.confirmadas.map((c) => (
                    <span
                      key={c.municipio}
                      className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"
                    >
                      {c.municipio} ({c.quantidade})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {temEsporo && (
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-semibold text-cta-foreground">
                  Esporo no ar (alerta precoce)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {resultado!.esporos.map((e) => (
                    <span
                      key={e.municipio}
                      className="rounded-full bg-cta/10 px-2 py-0.5 text-xs font-medium text-cta-foreground"
                    >
                      {e.municipio}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">Fonte: Consórcio Antiferrugem.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
