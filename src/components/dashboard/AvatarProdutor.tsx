import { cn } from "@/lib/utils";

/** Foto de perfil redonda; sem foto, as iniciais do nome sobre o verde da marca. */
export function AvatarProdutor({
  nome,
  fotoUrl,
  className,
}: {
  nome: string;
  fotoUrl?: string | null | undefined;
  className?: string;
}) {
  const iniciais =
    nome
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0] ?? "")
      .join("")
      .toUpperCase() || "?";
  return fotoUrl ? (
    <img
      src={fotoUrl}
      alt=""
      width={96}
      height={96}
      decoding="async"
      className={cn("shrink-0 rounded-full object-cover", className)}
    />
  ) : (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground",
        className,
      )}
    >
      {iniciais}
    </span>
  );
}
