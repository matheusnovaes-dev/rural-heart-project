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

/**
 * Telefone como o bot grava em `bot_conversas.telefone`: com o DDI 55, com e
 * sem o 9º dígito (o WhatsApp devolve o número de alguns DDDs sem o 9).
 * `normalizarWhatsapp` NÃO inclui o 55, então comparar o resultado dela
 * direto com `bot_conversas` nunca casava (achado 2026-10-13).
 */
export function telefonesDoBot(valor: string): string[] {
  const completo = `55${normalizarWhatsapp(valor)}`;
  const ddd = completo.slice(2, 4);
  const resto = completo.slice(4);
  const sem9 = resto.length === 9 && resto[0] === "9" ? `55${ddd}${resto.slice(1)}` : completo;
  return [...new Set([completo, sem9])];
}

/**
 * Máscara de digitação "(11) 91234-5678". Só formata o que o usuário já
 * digitou (nunca inventa dígito) e descarta o DDI 55 colado de contato.
 */
export function mascararTelefone(valor: string): string {
  let d = valor.replace(/\D/g, "");
  if (d.startsWith("55") && d.length > 11) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** DDD + 8 ou 9 dígitos (o 8 é normalizado pra 9 em normalizarWhatsapp). */
export function telefoneValido(valor: string): boolean {
  const d = valor.replace(/\D/g, "");
  const semDdi = d.startsWith("55") && d.length > 11 ? d.slice(2) : d;
  if (semDdi.length !== 10 && semDdi.length !== 11) return false;
  // DDD que existe no Brasil (11 a 99, sem 20, 23, 25, 26, 29, 30, 36, 39, 40, 50, 52, 56 a 60, 70, 72, 76, 78, 80, 90)
  // e, com 11 dígitos, celular começa com 9. "00000000000" passava e virava lead sem WhatsApp.
  if (!DDDS_VALIDOS.has(semDdi.slice(0, 2))) return false;
  if (semDdi.length === 11 && semDdi[2] !== "9") return false;
  return true;
}

export const DDDS_VALIDOS = new Set(
  "11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99".split(
    " ",
  ),
);
