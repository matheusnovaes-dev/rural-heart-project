/**
 * Normaliza um número de WhatsApp pra só dígitos (sem DDI), do jeito que o
 * bot do WhatsApp compara telefone: DDD + número, sem parênteses/traço/espaço.
 * Mantém o produtor buscável pelo bot e evita duplicidade por formatação
 * diferente do mesmo número (ex: "(37) 99833-3290" vs "37998333290").
 *
 * Também garante o 9º dígito quando o número vem no formato antigo (DDD +
 * 8 dígitos) — sem isso, o envio de lembretes/alertas (que monta o número
 * final como '55' + este valor, sem tentar as duas variantes como o bot
 * faz na entrada) sai incompleto e a mensagem não chega, sem erro nenhum
 * aparente na hora do cadastro.
 */
export function normalizarWhatsapp(valor: string): string {
  const digitos = valor.replace(/\D/g, "");
  const semDdi = digitos.startsWith("55") && digitos.length > 11 ? digitos.slice(2) : digitos;
  const ddd = semDdi.slice(0, 2);
  const resto = semDdi.slice(2);
  if (resto.length === 8) return ddd + "9" + resto;
  return semDdi;
}
