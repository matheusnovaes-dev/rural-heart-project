import { cn } from "@/lib/utils";

/** Esqueleto de carregamento: bloco suave com um brilho que passa. `data-skeleton` marca o "ainda carregando" (ver AbasPremium). */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-skeleton=""
      className={cn("skeleton-brilho rounded-md bg-primary/10", className)}
      {...props}
    />
  );
}

export { Skeleton };
