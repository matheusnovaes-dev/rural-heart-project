import type { ReactNode } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/**
 * Confirmação antes de uma ação que apaga algo (mesmo padrão dos alertas,
 * lembretes e funcionários): um toque na lixeira, principalmente no celular,
 * não pode apagar sem perguntar.
 */
export function ConfirmarAcao({
  gatilho,
  titulo,
  descricao,
  rotuloConfirmar = "Remover",
  aoConfirmar,
}: {
  gatilho: ReactNode;
  titulo: string;
  descricao: string;
  rotuloConfirmar?: string;
  aoConfirmar: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{gatilho}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>{descricao}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={aoConfirmar}>{rotuloConfirmar}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
