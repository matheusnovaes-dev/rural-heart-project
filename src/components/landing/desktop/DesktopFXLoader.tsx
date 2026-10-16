import { lazy, Suspense } from "react";

import { useDesktopFino } from "@/components/landing/desktop/useDesktopFino";

// O import dinâmico só roda quando o componente é renderizado: no celular (e no servidor) o código dos
// efeitos de desktop nunca é baixado.
const DesktopFX = lazy(() => import("@/components/landing/desktop/DesktopFX"));

/** leve: só cursor, botões magnéticos e letras que rolam (telas de login e cadastro, sem WebGL nem scroll suave). */
export function DesktopFXLoader({ leve = false }: { leve?: boolean }) {
  const fino = useDesktopFino();
  if (!fino) return null;
  return (
    <Suspense fallback={null}>
      <DesktopFX leve={leve} />
    </Suspense>
  );
}
