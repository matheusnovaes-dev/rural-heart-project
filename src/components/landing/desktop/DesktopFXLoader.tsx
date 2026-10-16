import { lazy, Suspense } from "react";

import { useDesktopFino } from "@/components/landing/desktop/useDesktopFino";

// O import dinâmico só roda quando o componente é renderizado: no celular (e no servidor) o código dos
// efeitos de desktop nunca é baixado.
const DesktopFX = lazy(() => import("@/components/landing/desktop/DesktopFX"));

export function DesktopFXLoader() {
  const fino = useDesktopFino();
  if (!fino) return null;
  return (
    <Suspense fallback={null}>
      <DesktopFX />
    </Suspense>
  );
}
