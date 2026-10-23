import { useEffect, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { obterFunilPagamento, type FunilPagamento as Funil } from "@/lib/funilPagamento.server";

/** Funil dos últimos 7 dias, até o pagamento. Só admin (a tela Leads já é só dele). */
export function FunilPagamento() {
  const { session } = useAuth();
  const token = session?.access_token;
  const [funil, setFunil] = useState<Funil | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    if (!token) return;
    let vivo = true;
    obterFunilPagamento({ data: { accessToken: token } })
      .then((r) => vivo && setFunil(r))
      .catch(() => vivo && setErro(true));
    return () => {
      vivo = false;
    };
  }, [token]);

  if (erro) return null;
  const maior = Math.max(1, ...(funil?.etapas.map((e) => e.valor) ?? [1]));

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <div>
          <h2 className="font-display text-lg font-semibold">Funil de pagamento, últimos 7 dias</h2>
          <p className="text-sm text-muted-foreground">
            Onde as pessoas param até pagar. Contas de teste ficam de fora.
          </p>
        </div>
        {funil === null ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {funil.etapas.map((e) => (
                <li key={e.chave} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span>
                      {e.rotulo}
                      {e.dica && <span className="text-xs text-muted-foreground"> ({e.dica})</span>}
                    </span>
                    <span className="font-semibold tabular-nums">{e.valor}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(2, (e.valor / maior) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">
              Em teste agora: <strong>{funil.emTeste}</strong>. Com o teste acabando em até 3 dias:{" "}
              <strong>{funil.testeVenceEm3Dias}</strong>.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
