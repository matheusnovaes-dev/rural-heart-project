/**
 * Normaliza um número de WhatsApp pra só dígitos (sem DDI), do jeito que o
 * bot do WhatsApp compara telefone: DDD + número, sem parênteses/traço/espaço.
 * Mantém o produtor buscável pelo bot e evita duplicidade por formatação
 * diferente do mesmo número (ex: "(37) 99833-3290" vs "37998333290").
 */
export function normalizarWhatsapp(valor: string): string {
  const digitos = valor.replace(/\D/g, "");
  return digitos.startsWith("55") && digitos.length > 11 ? digitos.slice(2) : digitos;
}
