const planoLabel: Record<string, string> = {
  bronze: "Bronze",
  prata: "Prata",
  ouro: "Ouro",
};

const planoPreco: Record<string, string> = {
  bronze: "R$ 39/mês",
  prata: "R$ 129/mês",
  ouro: "R$ 399/mês",
};

/**
 * Aviso de cobrança vencendo/vencida — pra quem não tem WhatsApp cadastrado
 * (cooperativas, que hoje não coletam telefone no cadastro). Produtores
 * recebem o aviso equivalente por WhatsApp via n8n, não por aqui.
 */
export async function enviarEmailCobranca({
  to,
  nome,
  plano,
  tipo,
  invoiceUrl,
}: {
  to: string;
  nome: string;
  plano: string;
  tipo: "vencendo" | "vencida";
  invoiceUrl: string;
}) {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) return;

  const escuro = "#16241B";
  const primaria = "#1F3D2B";
  const creme = "#F1EBDD";
  const primeiroNome = nome.split(" ")[0] || nome;
  const tituloAssunto =
    tipo === "vencendo"
      ? `Sua cobrança do Safralume vence em breve`
      : `Cobrança do Safralume vencida`;
  const mensagem =
    tipo === "vencendo"
      ? `A próxima cobrança do plano ${planoLabel[plano] ?? plano} (${planoPreco[plano] ?? ""}) vence em breve.`
      : `A cobrança do plano ${planoLabel[plano] ?? plano} (${planoPreco[plano] ?? ""}) venceu e ainda não foi paga. Regularize pra não perder o acesso.`;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Safralume <financeiro@safralume.com.br>",
        to,
        subject: `${tituloAssunto}, ${primeiroNome}`,
        html: `<!DOCTYPE html><html lang="pt-BR"><body style="margin:0;padding:0;background-color:${creme};font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" style="background-color:${creme};"><tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="480" style="width:480px;max-width:100%;background-color:#FFFFFF;border:1px solid #E2DCC9;">
<tr><td style="background-color:${escuro};padding:20px 28px;">
<span style="font-family:Georgia,serif;font-size:16px;letter-spacing:4px;color:#F6F2E7;text-transform:uppercase;">Safralume</span>
</td></tr>
<tr><td style="padding:28px;">
<p style="font-size:15px;color:${primaria};margin:0 0 12px 0;">Olá, ${primeiroNome}.</p>
<p style="font-size:14px;line-height:22px;color:#3A3F35;margin:0 0 20px 0;">${mensagem}</p>
<a href="${invoiceUrl}" style="display:inline-block;background-color:${primaria};color:#F6F2E7;font-size:13px;font-weight:bold;text-decoration:none;padding:12px 24px;border-radius:6px;">Ver fatura</a>
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #E2DCC9;">
<p style="font-size:11px;color:#8A9280;margin:0;">Dúvidas? Chama no WhatsApp: +55 31 9004-0215</p>
</td></tr>
</table></td></tr></table>
</body></html>`,
      }),
    });
  } catch (err) {
    console.error("Falha ao enviar e-mail de cobrança:", err);
  }
}

export async function enviarEmailBoasVindas({
  to,
  nome,
  plano,
}: {
  to: string;
  nome: string;
  plano: string;
}) {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) return;

  const appUrl = process.env["APP_URL"] ?? "https://www.safralume.com.br";

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Safralume <bem-vindo@safralume.com.br>",
        to,
        subject: `Que bom ter você por aqui, ${nome.split(" ")[0]}`,
        html: templateBoasVindas({
          nome: nome.split(" ")[0] || nome,
          plano: planoLabel[plano] ?? plano,
          preco: planoPreco[plano] ?? "",
          appUrl,
        }),
      }),
    });
  } catch (err) {
    // Falha no envio não deve derrubar o webhook do Stripe — a assinatura
    // já foi processada, o e-mail é um extra.
    console.error("Falha ao enviar e-mail de boas-vindas:", err);
  }
}

function templateBoasVindas({
  nome,
  plano,
  preco,
  appUrl,
}: {
  nome: string;
  plano: string;
  preco: string;
  appUrl: string;
}) {
  const serif = "Georgia,'Times New Roman',serif";
  const sans = "Arial,Helvetica,sans-serif";
  const escuro = "#16241B";
  const primaria = "#1F3D2B";
  const sage = "#75B68C";
  const sageClaro = "#B0DABD";
  const creme = "#F1EBDD";
  const logoUrl = `${appUrl}/apple-touch-icon.png`;

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="pt-BR">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>Que bom ter você por aqui, ${nome}</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style type="text/css">
  body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
  table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;}
  img{-ms-interpolation-mode:bicubic;border:0;height:auto;line-height:100%;outline:none;text-decoration:none;display:block;}
  body{margin:0!important;padding:0!important;width:100%!important;background-color:${creme};}
  a{color:${primaria};}
  .sf-rule{border-top:1px solid ${sageClaro};font-size:0;line-height:0;}

  @media screen and (max-width:620px){
    .wrap{width:100%!important;}
    .px{padding-left:26px!important;padding-right:26px!important;}
    .h1{font-size:28px!important;line-height:35px!important;}
    .stack{display:block!important;width:100%!important;max-width:100%!important;}
    .stack-pad{padding:16px 26px!important;}
    .btn a{display:block!important;}
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${creme};">

<div style="display:none;font-size:1px;color:${creme};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  Sua assinatura ${plano} está ativa. O preço da sua safra já está a uma mensagem de distância no WhatsApp.
  &#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;
</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${creme};">
<tr>
<td align="center" style="padding:32px 12px 44px 12px;">

  <table role="presentation" class="wrap" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;background-color:#FFFFFF;border:1px solid #E2DCC9;">

    <tr>
      <td align="center" bgcolor="${escuro}" style="background-color:${escuro};padding:11px 20px;font-family:${sans};font-size:10px;letter-spacing:2.6px;text-transform:uppercase;color:${sage};">
        Preço agrícola oficial &nbsp;&#183;&nbsp; Direto no WhatsApp
      </td>
    </tr>

    <tr>
      <td align="center" class="px" style="padding:40px 48px 30px 48px;">
        <img src="${logoUrl}" width="72" height="72" alt="Safralume" style="display:block;width:72px;height:72px;margin:0 auto 20px auto;border-radius:16px;" />
        <div style="font-family:${serif};font-size:25px;letter-spacing:9px;color:${primaria};text-transform:uppercase;padding-left:9px;">Safralume</div>
        <div style="font-family:${sans};font-size:10px;letter-spacing:3px;color:#8A9280;text-transform:uppercase;padding:11px 0 0 2px;">Preço líquido da sua saca</div>
      </td>
    </tr>

    <tr>
      <td class="px" style="padding:0 48px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr><td class="sf-rule" height="1">&nbsp;</td></tr>
          <tr><td height="3" style="font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr><td class="sf-rule" height="1">&nbsp;</td></tr>
        </table>
      </td>
    </tr>

    <tr>
      <td bgcolor="${escuro}" class="px" style="background-color:${escuro};padding:52px 48px 48px 48px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="font-family:${sans};font-size:10px;letter-spacing:3.2px;text-transform:uppercase;color:${sage};padding-bottom:20px;">
              Sua assinatura está ativa
            </td>
          </tr>
          <tr>
            <td class="h1" style="font-family:${serif};font-size:34px;line-height:42px;color:#F6F2E7;padding-bottom:18px;">
              Que bom ter você<br />por aqui, ${nome}.
            </td>
          </tr>
          <tr>
            <td style="font-family:${sans};font-size:15px;line-height:26px;color:#CBD8C1;padding-bottom:32px;">
              Todo preço que você recebe aqui sai direto dos boletins oficiais da Conab e da Imea, com o frete da sua região já descontado e a fonte sempre visível. A partir de agora, é só perguntar.
            </td>
          </tr>
          <tr>
            <td class="btn">
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${appUrl}/dashboard" style="height:52px;v-text-anchor:middle;width:230px;" arcsize="0%" strokecolor="#F6F2E7" fillcolor="#F6F2E7">
                <w:anchorlock/>
                <center style="color:${escuro};font-family:Arial,sans-serif;font-size:12px;letter-spacing:2px;font-weight:bold;">ABRIR MEU PAINEL</center>
              </v:roundrect>
              <![endif]-->
              <!--[if !mso]><!-- -->
              <a href="${appUrl}/dashboard" style="display:inline-block;background-color:#F6F2E7;color:${escuro};font-family:${sans};font-size:12px;font-weight:bold;letter-spacing:2.2px;text-transform:uppercase;text-decoration:none;padding:18px 40px;text-align:center;border:1px solid #F6F2E7;">Abrir meu painel</a>
              <!--<![endif]-->
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td class="px" style="padding:40px 48px 10px 48px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px dashed #A8C48C;background-color:#F2F5EA;">
          <tr>
            <td align="center" style="padding:30px 24px 32px 24px;">
              <div style="font-family:${sans};font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#6E8F5E;padding-bottom:14px;">Seu plano</div>
              <div style="font-family:${serif};font-size:28px;letter-spacing:4px;color:${primaria};padding-bottom:12px;text-transform:uppercase;">${plano}</div>
              <div style="font-family:${sans};font-size:13px;line-height:21px;color:#5E6857;">
                7 dias grátis pra testar sem compromisso.<br />
                Depois, ${preco}. Cancele quando quiser, direto pelo painel.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td class="px" style="padding:36px 48px 8px 48px;">
        <div style="font-family:${sans};font-size:10px;letter-spacing:3.2px;text-transform:uppercase;color:#8A9280;padding-bottom:24px;">Por onde começar</div>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td width="46" valign="top" style="width:46px;padding-bottom:26px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="34" height="34" style="width:34px;height:34px;border:1px solid #A8C48C;">
                <tr><td align="center" valign="middle" style="font-family:${serif};font-size:14px;color:${primaria};height:34px;">1</td></tr>
              </table>
            </td>
            <td valign="top" style="padding-bottom:26px;">
              <div style="font-family:${serif};font-size:17px;color:${primaria};padding-bottom:6px;">Mande uma mensagem</div>
              <div style="font-family:${sans};font-size:14px;line-height:23px;color:#5E6857;">Chama no WhatsApp <strong>+55 31 9004-0215</strong> e pergunta o preço da sua cultura e cidade, do jeito que você já usa o WhatsApp.</div>
            </td>
          </tr>
          <tr>
            <td width="46" valign="top" style="width:46px;padding-bottom:26px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="34" height="34" style="width:34px;height:34px;border:1px solid #A8C48C;">
                <tr><td align="center" valign="middle" style="font-family:${serif};font-size:14px;color:${primaria};height:34px;">2</td></tr>
              </table>
            </td>
            <td valign="top" style="padding-bottom:26px;">
              <div style="font-family:${serif};font-size:17px;color:${primaria};padding-bottom:6px;">Cruzamos os dados oficiais</div>
              <div style="font-family:${sans};font-size:14px;line-height:23px;color:#5E6857;">Consultamos Conab e Imea na hora e aplicamos o frete líquido até a sua região.</div>
            </td>
          </tr>
          <tr>
            <td width="46" valign="top" style="width:46px;padding-bottom:30px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="34" height="34" style="width:34px;height:34px;border:1px solid #A8C48C;">
                <tr><td align="center" valign="middle" style="font-family:${serif};font-size:14px;color:${primaria};height:34px;">3</td></tr>
              </table>
            </td>
            <td valign="top" style="padding-bottom:30px;">
              <div style="font-family:${serif};font-size:17px;color:${primaria};padding-bottom:6px;">Você recebe o número certo</div>
              <div style="font-family:${sans};font-size:14px;line-height:23px;color:#5E6857;">Preço líquido, com fonte e data, pronto pra decidir sem depender de planilha.</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td class="px" style="padding:0 48px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid #E2DCC9;border-bottom:1px solid #E2DCC9;">
          <tr>
            <td class="stack stack-pad" width="33.33%" align="center" valign="top" style="padding:26px 8px;">
              <div style="font-family:${serif};font-size:19px;color:${primaria};padding-bottom:5px;">Conab + Imea</div>
              <div style="font-family:${sans};font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#8A9280;">Fonte oficial</div>
            </td>
            <td class="stack stack-pad" width="33.33%" align="center" valign="top" style="padding:26px 8px;">
              <div style="font-family:${serif};font-size:19px;color:${primaria};padding-bottom:5px;">7 dias</div>
              <div style="font-family:${sans};font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#8A9280;">Teste grátis</div>
            </td>
            <td class="stack stack-pad" width="33.33%" align="center" valign="top" style="padding:26px 8px;">
              <div style="font-family:${serif};font-size:19px;color:${primaria};padding-bottom:5px;">Zero app</div>
              <div style="font-family:${sans};font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#8A9280;">Só WhatsApp</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td align="center" class="px" style="padding:44px 56px 46px 56px;">
        <div style="font-family:${serif};font-style:italic;font-size:19px;line-height:30px;color:${primaria};padding-bottom:6px;">
          &#8220;Preço líquido, direto no WhatsApp &#8212; sem planilha, sem esperar boletim.&#8221;
        </div>
      </td>
    </tr>

    <tr>
      <td bgcolor="${escuro}" class="px" align="center" style="background-color:${escuro};padding:38px 48px 34px 48px;">
        <div style="font-family:${serif};font-size:15px;letter-spacing:7px;color:${sageClaro};text-transform:uppercase;padding:0 0 22px 7px;">Safralume</div>

        <div style="font-family:${sans};font-size:11px;letter-spacing:2px;text-transform:uppercase;padding-bottom:24px;">
          <a href="${appUrl}/dashboard" style="color:${sageClaro};text-decoration:none;">Meu painel</a>
          <span style="color:#4A6350;">&nbsp;&nbsp;/&nbsp;&nbsp;</span>
          <a href="${appUrl}/termos" style="color:${sageClaro};text-decoration:none;">Termos</a>
          <span style="color:#4A6350;">&nbsp;&nbsp;/&nbsp;&nbsp;</span>
          <a href="${appUrl}/privacidade" style="color:${sageClaro};text-decoration:none;">Privacidade</a>
        </div>

        <div style="font-family:${sans};font-size:11px;line-height:19px;color:#8FA593;">
          Você recebeu este e-mail porque sua assinatura no Safralume foi ativada.<br />
          Dúvidas? Chama no WhatsApp: +55 31 9004-0215
        </div>
      </td>
    </tr>

  </table>

</td>
</tr>
</table>

</body>
</html>`;
}
