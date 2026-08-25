import { useEffect, useState } from "react";
import { ExternalLink, Newspaper } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { supabase } from "@/lib/supabase";
import type { Produtor } from "@/lib/auth";

type Boletim = {
  id: string;
  titulo: string;
  data_publicacao: string;
  url_leitura: string;
  manchete: string | null;
  resumo: string | null;
};

// As 4 cadeias com Boletim Semanal vivo na Imea (mesmo escopo do
// ingest-imea.mjs) — Leite (boletim obsoleto) e Suínos (sem boletim de
// preço) ficam fora, então a seção simplesmente não aparece pra essas
// culturas em vez de fingir que existe conteúdo.
const IMEA_CADEIA_POR_CULTURA: Record<string, string> = {
  soja: "soja",
  milho: "milho",
  "algodão em pluma": "algodao",
  boi: "boi",
};

function formatarData(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function LinkBoletim({ titulo, data, url }: { titulo: string; data: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-lg border border-border p-2.5 transition-colors hover:bg-secondary/60"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{titulo}</p>
        <p className="text-xs text-muted-foreground">{formatarData(data)}</p>
      </div>
      <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
    </a>
  );
}

function CardDestaque({ boletim }: { boletim: Boletim }) {
  if (!boletim.manchete || !boletim.resumo) {
    return (
      <LinkBoletim
        titulo={boletim.titulo}
        data={boletim.data_publicacao}
        url={boletim.url_leitura}
      />
    );
  }
  return (
    <div className="rounded-lg border border-border p-3.5">
      <p className="text-xs text-muted-foreground">
        {boletim.titulo} · {formatarData(boletim.data_publicacao)}
      </p>
      <p className="mt-1 font-display text-base font-semibold text-foreground">
        {boletim.manchete}
      </p>
      <p className="mt-1.5 text-sm text-muted-foreground">{boletim.resumo}</p>
      <Button asChild size="sm" variant="outline" className="mt-3">
        <a href={boletim.url_leitura} target="_blank" rel="noopener noreferrer">
          Ler boletim completo
          <ExternalLink className="size-3.5" />
        </a>
      </Button>
    </div>
  );
}

/**
 * Conteúdo de referência de mercado (Boletim Semanal da Imea) direto no
 * dashboard — não é cálculo exclusivo, é a mesma publicação que a Imea
 * disponibiliza de graça, com manchete e resumo extraídos do PDF (posição
 * de fonte, não IA) pra dar pra ler sem sair do app. Por isso fica aberta a
 * todos os planos, diferente da Watchlist (Ouro-only).
 */
export function BoletimSemanal({ produtor }: { produtor: Produtor }) {
  const [boletins, setBoletins] = useState<Boletim[] | null>(null);
  const cadeia = produtor.cultura_principal
    ? IMEA_CADEIA_POR_CULTURA[produtor.cultura_principal]
    : null;

  useEffect(() => {
    if (!supabase || !cadeia) return;
    supabase
      .from("imea_boletins")
      .select("id, titulo, data_publicacao, url_leitura, manchete, resumo")
      .eq("cadeia", cadeia)
      .order("data_publicacao", { ascending: false })
      .limit(5)
      .then(({ data }) => setBoletins(data ?? []));
  }, [cadeia]);

  if (!cadeia) return null;

  return (
    <Card className="gap-3">
      <CardHeader className="pb-0">
        <CardTitle className="flex items-center gap-2 font-display text-base font-semibold">
          <Newspaper className="size-4 text-primary" />
          Boletim Semanal
        </CardTitle>
        <CardDescription>Análise de mercado da Imea pra sua cultura, direto aqui.</CardDescription>
      </CardHeader>
      <CardContent>
        {boletins === null ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : boletins.length === 0 ? (
          <EmptyState
            icon={Newspaper}
            title="Nenhuma edição ainda"
            description="Assim que sair a primeira edição pra sua cultura, ela aparece aqui."
          />
        ) : (
          <div className="flex flex-col gap-3">
            <CardDestaque boletim={boletins[0]!} />
            {boletins.length > 1 && (
              <div className="flex flex-col gap-1.5">
                {boletins.slice(1).map((b) => (
                  <LinkBoletim
                    key={b.id}
                    titulo={b.manchete ?? b.titulo}
                    data={b.data_publicacao}
                    url={b.url_leitura}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
