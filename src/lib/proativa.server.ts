/**
 * Envio de mensagem proativa pelo WhatsApp (modelo aprovado `mensagem_proativa_safralume_v4`, com o nome e um texto
 * livre), pelo mesmo webhook do n8n que o cron de mensagem proativa usa. Lança erro quando o envio falha, para o
 * chamador só marcar "enviado" se de fato saiu.
 */
const TEMPLATE_PROATIVA = "mensagem_proativa_safralume_v4";

export async function enviarMensagemProativa(whatsapp: string, nome: string, texto: string) {
  const webhookUrl = process.env["N8N_COBRANCA_WEBHOOK_URL"];
  const token = process.env["N8N_COBRANCA_TOKEN"];
  if (!webhookUrl || !token) throw new Error("webhook do n8n não configurado");
  const primeiroNome = nome.trim().split(" ")[0] || nome;
  const resposta = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-safralume-token": token },
    body: JSON.stringify({
      telefone: `55${whatsapp}`,
      template: TEMPLATE_PROATIVA,
      nome: primeiroNome,
      resumo: texto,
    }),
  });
  if (!resposta.ok) throw new Error(`webhook do n8n respondeu ${resposta.status}`);
}
