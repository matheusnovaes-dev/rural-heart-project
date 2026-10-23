/**
 * CPF/CNPJ cifrado em repouso (AES-256-GCM). O banco guarda "v1:" + base64(iv 12 bytes + texto cifrado + etiqueta de autenticação);
 * a chave fica só no servidor (segredo DOCUMENTO_CHAVE, 32 bytes em base64), nunca no banco nem no navegador. Quem vazar uma cópia do
 * banco, ou a chave de serviço do Supabase sozinha, não consegue ler os documentos.
 *
 * Regras de segurança do dia a dia (o checkout nunca pode quebrar por causa disso):
 *  - Sem chave configurada (ou chave mal formada) o documento continua sendo gravado em texto, com aviso no log. Assim publicar o código
 *    antes de cadastrar o segredo não derruba nada; o teste de ponta a ponta confere que está cifrando de verdade.
 *  - Leitura aceita os dois formatos: "v1:..." (decifra) e só números (legado, devolve como está).
 *  - Valor "v1:" adulterado, ou cifrado com outra chave, lança DocumentoIlegivelError: quem chama pede o documento de novo à pessoa
 *    em vez de mandar lixo para a Asaas.
 * Este arquivo não importa nada do app, para poder ser testado com `bun` direto.
 */
const PREFIXO = "v1:";

export class DocumentoIlegivelError extends Error {
  constructor() {
    super("Documento salvo não pôde ser lido.");
    this.name = "DocumentoIlegivelError";
  }
}

export const ehDocumentoCifrado = (valor: string | null | undefined): boolean =>
  typeof valor === "string" && valor.startsWith(PREFIXO);

const soDigitos = (t: string) => t.replace(/\D/g, "");

function bytesDeBase64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function base64DeBytes(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

let avisouSemChave = false;

/** A chave pronta para uso, ou null se não houver uma chave válida configurada. */
async function chaveAtual(): Promise<CryptoKey | null> {
  const bruto = (
    typeof process !== "undefined" ? process.env["DOCUMENTO_CHAVE"] : undefined
  )?.trim();
  if (!bruto) {
    if (!avisouSemChave) {
      avisouSemChave = true;
      console.warn("DOCUMENTO_CHAVE ausente: CPF/CNPJ sendo gravado SEM cifra.");
    }
    return null;
  }
  try {
    const bytes = bytesDeBase64(bruto);
    if (bytes.length !== 32) throw new Error("tamanho");
    return await crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
  } catch {
    if (!avisouSemChave) {
      avisouSemChave = true;
      console.error(
        "DOCUMENTO_CHAVE inválida (precisa ter 32 bytes em base64): CPF/CNPJ sendo gravado SEM cifra.",
      );
    }
    return null;
  }
}

/** Há uma chave válida configurada? (usado pelo teste de ponta a ponta e pela conferência depois de publicar) */
export async function cifraDisponivel(): Promise<boolean> {
  return (await chaveAtual()) !== null;
}

/** Cifra um CPF/CNPJ (só os dígitos entram). Sem chave válida devolve os dígitos em texto. */
export async function cifrarDocumento(documento: string): Promise<string> {
  const digitos = soDigitos(documento);
  if (!digitos) return "";
  const chave = await chaveAtual();
  if (!chave) return digitos;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cifrado = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, chave, new TextEncoder().encode(digitos)),
  );
  const junto = new Uint8Array(iv.length + cifrado.length);
  junto.set(iv, 0);
  junto.set(cifrado, iv.length);
  return PREFIXO + base64DeBytes(junto);
}

/**
 * Devolve só os dígitos do documento. null/vazio => null. Legado em texto => os próprios dígitos.
 * "v1:" ilegível (adulterado, chave errada ou ausente) => DocumentoIlegivelError.
 */
export async function decifrarDocumento(valor: string | null | undefined): Promise<string | null> {
  if (valor == null || valor === "") return null;
  if (!ehDocumentoCifrado(valor)) return soDigitos(valor) || null;
  const chave = await chaveAtual();
  if (!chave) throw new DocumentoIlegivelError();
  try {
    const junto = bytesDeBase64(valor.slice(PREFIXO.length));
    if (junto.length < 13 + 16) throw new Error("curto");
    const claro = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: junto.slice(0, 12) },
      chave,
      junto.slice(12),
    );
    const texto = soDigitos(new TextDecoder().decode(claro));
    if (!texto) throw new Error("vazio");
    return texto;
  } catch {
    throw new DocumentoIlegivelError();
  }
}

/**
 * O documento que a pessoa digitou agora, só se for aproveitável (11+ dígitos). Um valor cifrado ("v1:..."), que uma página antiga
 * aberta no navegador pode devolver no lugar do CPF, NUNCA vale como documento digitado: o servidor usa o que está salvo.
 */
export function documentoDigitadoUtil(bruto: string | null | undefined): string | null {
  const texto = bruto ?? "";
  if (texto.startsWith(PREFIXO)) return null;
  const digitos = soDigitos(texto);
  return digitos.length >= 11 ? digitos : null;
}
