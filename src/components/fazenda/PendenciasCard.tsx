import { CalendarClock, CheckCircle2, Pencil, Trash2 } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  formatarQuantidade,
  formatarReais,
  fraseDeVencimento,
  resumirPendencias,
  type Pendencia,
  type RegistroFazenda,
} from "@/lib/fazenda.shared";

/** A pagar e a receber: o que ainda vai sair ou entrar, com o vencimento e o botão de dar baixa. */
export function PendenciasCard({
  pendentes,
  onBaixa,
  onEditar,
  onApagar,
}: {
  pendentes: RegistroFazenda[];
  onBaixa: (r: RegistroFazenda) => void;
  onEditar: (r: RegistroFazenda) => void;
  onApagar: (r: RegistroFazenda) => void;
}) {
  const r = useMemo(() => resumirPendencias(pendentes), [pendentes]);
  if (pendentes.length === 0) return null;
  return (
    <Card data-testid="pendencias">
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center gap-2">
          <CalendarClock className="size-4 text-muted-foreground" />
          <h2 className="font-display text-base font-semibold">A pagar e a receber</h2>
          {r.vencidas > 0 && (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
              {r.vencidas} {r.vencidas === 1 ? "vencido" : "vencidos"}
            </span>
          )}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Coluna
            titulo="A receber"
            total={r.totalAReceber}
            itens={r.aReceber}
            rotuloBaixa="Recebi"
            positivo
            onBaixa={onBaixa}
            onEditar={onEditar}
            onApagar={onApagar}
          />
          <Coluna
            titulo="A pagar"
            total={r.totalAPagar}
            itens={r.aPagar}
            rotuloBaixa="Paguei"
            onBaixa={onBaixa}
            onEditar={onEditar}
            onApagar={onApagar}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Eu te lembro no WhatsApp, às 8h do dia do vencimento. O valor só entra nas contas do
          caderno quando você dá baixa.
        </p>
      </CardContent>
    </Card>
  );
}

function Coluna({
  titulo,
  total,
  itens,
  rotuloBaixa,
  positivo,
  onBaixa,
  onEditar,
  onApagar,
}: {
  titulo: string;
  total: number;
  itens: Pendencia[];
  rotuloBaixa: string;
  positivo?: boolean;
  onBaixa: (r: RegistroFazenda) => void;
  onEditar: (r: RegistroFazenda) => void;
  onApagar: (r: RegistroFazenda) => void;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium text-muted-foreground">{titulo}</h3>
        <span
          className={`font-mono text-sm font-semibold tabular-nums ${positivo ? "text-primary" : ""}`}
        >
          {formatarReais(total)}
        </span>
      </div>
      {itens.length === 0 ? (
        <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          Nada por aqui.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {itens.map((p) => {
            const x = p.registro;
            const qtd =
              x.quantidade !== null && x.unidade
                ? `${formatarQuantidade(x.quantidade)} ${x.unidade}`
                : null;
            return (
              <li key={x.id} className="flex flex-wrap items-center gap-x-2 gap-y-1.5 p-3">
                <div className="min-w-0 flex-1 basis-36">
                  <p className="truncate text-sm font-medium">
                    {x.tipo === "venda"
                      ? `Venda${x.cultura ? ` de ${x.cultura.toLowerCase()}` : ""}${qtd ? `, ${qtd}` : ""}`
                      : x.descricao}
                  </p>
                  <p
                    className={`text-xs ${p.dias < 0 ? "font-medium text-destructive" : "text-muted-foreground"}`}
                  >
                    {fraseDeVencimento(p.dias, p.vencimento)}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">
                  {formatarReais(x.valor ?? 0)}
                </span>
                <div className="ml-auto flex shrink-0 items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 shrink-0 px-2.5"
                    onClick={() => onBaixa(x)}
                    aria-label={`${rotuloBaixa}: ${x.descricao}`}
                  >
                    <CheckCircle2 className="size-3.5" />
                    {rotuloBaixa}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    onClick={() => onEditar(x)}
                    aria-label="Editar lançamento"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    onClick={() => onApagar(x)}
                    aria-label="Apagar lançamento"
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
