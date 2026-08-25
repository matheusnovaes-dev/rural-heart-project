import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function tempoRelativo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const horas = Math.round(min / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.round(horas / 24);
  if (dias === 1) return "ontem";
  if (dias < 30) return `há ${dias} dias`;
  const meses = Math.round(dias / 30);
  return `há ${meses} ${meses === 1 ? "mês" : "meses"}`;
}

/**
 * "Atualizado há 2 h" com a data exata no tooltip. Usa o updated_at que o
 * ingest já grava mas que nunca aparecia na tela — sinal de frescor do dado.
 */
export function AtualizadoEm({ iso, className = "" }: { iso: string; className?: string }) {
  const exato = new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`cursor-default text-xs ${className}`}>
          Atualizado {tempoRelativo(iso)}
        </span>
      </TooltipTrigger>
      <TooltipContent>{exato}</TooltipContent>
    </Tooltip>
  );
}
