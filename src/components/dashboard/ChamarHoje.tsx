import { useEffect, useMemo, useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { listarQuemChamarHoje, type Grupo, type PessoaParaChamar } from "@/lib/chamarHoje.server";

const CHAVE = "safralume:chamados";

const ROTULO: Record<Grupo, { titulo: string; dica: string }> = {
  quente: {
    titulo: "Usando agora, teste acabando",
    dica: "Quem já usa é quem mais converte: pergunte o que achou.",
  },
  ajudar: {
    titulo: "Ainda não testou",
    dica: "Cadastrou e não mandou mensagem: ajude a dar o primeiro passo.",
  },
  reconquistar: { titulo: "Usou e sumiu", dica: "Descubra o que faltou antes de o teste acabar." },
  vencido: {
    titulo: "Teste venceu há pouco",
    dica: "Ainda lembram do produto: pergunte o que achou.",
  },
};

function lerChamados(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

/** Lista priorizada de quem chamar hoje, com roteiro pronto e botão que abre o WhatsApp. Só admin. */
export function ChamarHoje() {
  const { session } = useAuth();
  const token = session?.access_token;
  const [lista, setLista] = useState<PessoaParaChamar[] | null>(null);
  const [erro, setErro] = useState(false);
  const [chamados, setChamados] = useState<Record<string, string>>({});

  useEffect(() => {
    setChamados(lerChamados());
  }, []);

  useEffect(() => {
    if (!token) return;
    let vivo = true;
    listarQuemChamarHoje({ data: { accessToken: token } })
      .then((r) => vivo && setLista(r))
      .catch(() => vivo && setErro(true));
    return () => {
      vivo = false;
    };
  }, [token]);

  const grupos = useMemo(() => {
    const ordem: Grupo[] = ["quente", "ajudar", "reconquistar", "vencido"];
    return ordem
      .map((g) => ({ g, itens: (lista ?? []).filter((p) => p.grupo === g) }))
      .filter((x) => x.itens.length > 0);
  }, [lista]);

  function marcar(p: PessoaParaChamar) {
    const novo = { ...chamados };
    if (novo[p.id]) delete novo[p.id];
    else novo[p.id] = new Date().toISOString();
    setChamados(novo);
    try {
      localStorage.setItem(CHAVE, JSON.stringify(novo));
    } catch {
      // sem armazenamento: a marca vale só até recarregar
    }
  }

  async function copiar(p: PessoaParaChamar) {
    try {
      await navigator.clipboard.writeText(p.script);
      toast.success("Roteiro copiado.");
    } catch {
      toast.error("Não consegui copiar. Selecione o texto e copie.");
    }
  }

  const abrirWhats = (p: PessoaParaChamar) => {
    const numero = p.telefone.startsWith("55") ? p.telefone : `55${p.telefone}`;
    return `https://wa.me/${numero}?text=${encodeURIComponent(p.script)}`;
  };

  if (erro) return null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 pt-6">
        <div>
          <h2 className="font-display text-lg font-semibold">Quem chamar hoje</h2>
          <p className="text-sm text-muted-foreground">
            Gente em teste grátis, da mais quente para a mais fria. O botão abre o WhatsApp com o
            roteiro pronto: ajuste ao jeito da pessoa antes de enviar. A marca "chamei" fica salva
            só neste navegador.
          </p>
        </div>

        {lista === null ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : grupos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ninguém para chamar agora. 🌱</p>
        ) : (
          grupos.map(({ g, itens }) => (
            <section key={g} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <h3 className="text-sm font-semibold">
                  {ROTULO[g].titulo} <span className="text-muted-foreground">({itens.length})</span>
                </h3>
                <span className="text-xs text-muted-foreground">{ROTULO[g].dica}</span>
              </div>
              <ul className="flex flex-col gap-2">
                {itens.map((p) => {
                  const feito = !!chamados[p.id];
                  return (
                    <li key={p.id} className={`rounded-lg border p-3 ${feito ? "opacity-60" : ""}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{p.nome}</span>
                        {p.cultura && <Badge variant="secondary">{p.cultura}</Badge>}
                        {p.uf && <Badge variant="outline">{p.uf}</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{p.motivo}</p>
                      <p className="mt-2 whitespace-pre-line rounded-md bg-muted/50 p-2 text-sm">
                        {p.script}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button asChild size="sm">
                          <a href={abrirWhats(p)} target="_blank" rel="noopener noreferrer">
                            <MessageCircle className="mr-1.5 size-3.5" aria-hidden="true" />
                            Abrir no WhatsApp
                          </a>
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => copiar(p)}>
                          <Copy className="mr-1.5 size-3.5" aria-hidden="true" />
                          Copiar roteiro
                        </Button>
                        <Button
                          size="sm"
                          variant={feito ? "default" : "ghost"}
                          onClick={() => marcar(p)}
                        >
                          <Check className="mr-1.5 size-3.5" aria-hidden="true" />
                          {feito ? "Chamei" : "Marcar como chamei"}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </CardContent>
    </Card>
  );
}
