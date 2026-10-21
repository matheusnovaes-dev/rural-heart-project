import { MapPin } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { formatarReais, type ResumoCaderno } from "@/lib/fazenda.shared";

/** Gasto por talhão (ou gleba, pasto, área): clicar filtra a lista de lançamentos. */
export function PorTalhaoCard({
  porTalhao,
  onFiltrar,
}: {
  porTalhao: ResumoCaderno["porTalhao"];
  onFiltrar: (talhao: string) => void;
}) {
  if (porTalhao.length === 0) return null;
  const maior = Math.max(1, ...porTalhao.map((t) => t.gasto));
  return (
    <Card data-testid="por-talhao">
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-center gap-2">
          <MapPin className="size-4 text-muted-foreground" />
          <h2 className="font-display text-base font-semibold">Gasto por talhão</h2>
        </div>
        <ul className="space-y-2.5">
          {porTalhao.slice(0, 8).map((t) => (
            <li key={t.chave}>
              <button
                type="button"
                onClick={() => onFiltrar(t.talhao)}
                className="block w-full text-left"
                aria-label={`Ver lançamentos de ${t.talhao}`}
              >
                <div className="mb-1 flex justify-between gap-3 text-sm">
                  <span className="truncate">
                    {t.talhao}
                    {t.culturas.length > 0 && (
                      <span className="text-muted-foreground">
                        {" "}
                        · {t.culturas.map((c) => c.toLowerCase()).join(", ")}
                      </span>
                    )}
                  </span>
                  <span className="font-mono tabular-nums">{formatarReais(t.gasto)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary/70"
                    style={{ width: `${Math.max(3, (t.gasto / maior) * 100)}%` }}
                  />
                </div>
              </button>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Só entram os gastos lançados com o nome do talhão (por exemplo, “talhão 3”).
        </p>
      </CardContent>
    </Card>
  );
}
