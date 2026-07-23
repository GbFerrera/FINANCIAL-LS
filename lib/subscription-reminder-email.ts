import type { ReminderTemplateVars } from "./subscription-reminder"
import { plainTextToHtml } from "./subscription-reminder"
import type { ReminderPixPayload } from "./pix-copia-cola"

export type ReminderEmailBranding = {
  brandName?: string
  supportEmail?: string
  logoUrl?: string
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function firstName(full: string) {
  const part = full.trim().split(/\s+/)[0]
  if (!part) return full.trim() || "Cliente"
  return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
}

function urgencyMeta(daysUntilDue: number) {
  if (daysUntilDue <= 0) {
    return {
      label: "Vence hoje",
      sub: "Regularize hoje para evitar interrupções.",
      accent: "#dc2626",
      accentSoft: "#fef2f2",
      border: "#fecaca",
    }
  }
  if (daysUntilDue === 1) {
    return {
      label: "Vence amanhã",
      sub: "Falta 1 dia para o vencimento da sua assinatura.",
      accent: "#ea580c",
      accentSoft: "#fff7ed",
      border: "#fed7aa",
    }
  }
  return {
    label: `Faltam ${daysUntilDue} dias`,
    sub: "Este é um lembrete automático antes do vencimento.",
    accent: "#2563eb",
    accentSoft: "#eff6ff",
    border: "#bfdbfe",
  }
}

export function buildReminderEmailHtml(input: {
  bodyText: string
  vars: ReminderTemplateVars
  daysUntilDue: number
  branding?: ReminderEmailBranding
  pix?: ReminderPixPayload | null
}) {
  const branding = { ...input.branding }
  if (!branding.brandName) {
    branding.brandName =
      (typeof process !== "undefined" && process.env?.REMINDER_EMAIL_BRAND_NAME?.trim()) ||
      "Link System"
  }
  if (!branding.supportEmail && typeof process !== "undefined") {
    branding.supportEmail =
      process.env.REMINDER_EMAIL_SUPPORT?.trim() || process.env.SMTP_FROM?.trim() || undefined
  }
  if (!branding.logoUrl && typeof process !== "undefined") {
    branding.logoUrl = process.env.REMINDER_EMAIL_LOGO_URL?.trim() || undefined
  }

  const brand = escapeHtml(branding.brandName || "Link System")
  const nome = escapeHtml(input.vars.nome)
  const greeting = escapeHtml(firstName(input.vars.nome))
  const plano = escapeHtml(input.vars.plano)
  const preco = escapeHtml(input.vars.preco)
  const vencimento = escapeHtml(input.vars.vencimento)
  const grupo = escapeHtml(input.vars.grupo)
  const empresa =
    input.vars.empresa && input.vars.empresa !== "—"
      ? escapeHtml(input.vars.empresa)
      : null

  const days = Number.parseInt(input.vars.dias_antes, 10)
  const daysUntilDue = Number.isFinite(days) ? days : input.daysUntilDue
  const urgency = urgencyMeta(daysUntilDue)

  const bodyHtml = plainTextToHtml(input.bodyText)
  const support = branding.supportEmail ? escapeHtml(branding.supportEmail) : null

  const pix = input.pix
  const pixHtml = pix
    ? `
          <tr>
            <td style="padding:0 32px 28px;">
              <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">Pix</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #bbf7d0;border-radius:12px;overflow:hidden;background:#f0fdf4;">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0 0 8px;font-size:14px;color:#166534;">Recebedor: <strong>${escapeHtml(pix.receiverName)}</strong></p>
                    ${pix.amountLabel ? `<p style="margin:0 0 14px;font-size:14px;color:#166534;">Valor: <strong>${escapeHtml(pix.amountLabel)}</strong></p>` : ""}
                    ${
                      pix.copiaCola
                        ? `<p style="margin:0 0 8px;font-size:13px;color:#15803d;">Pix copia e cola — selecione a linha inteira e copie:</p>
                    <pre style="margin:0 0 12px;font-size:11px;line-height:1.45;color:#14532d;font-family:ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap;word-break:normal;overflow-x:auto;background:#dcfce7;border-radius:8px;padding:14px;user-select:all;-webkit-user-select:all;">${escapeHtml(pix.copiaCola)}</pre>
                    <p style="margin:0;font-size:12px;line-height:1.5;color:#166534;">No app do banco: Pix → Pix copia e cola → Colar.</p>`
                        : `<p style="margin:0;font-size:13px;color:#166534;">Não foi possível gerar o Pix copia e cola para este lembrete. Entre em contato conosco para pagar.</p>`
                    }
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
    : ""

  const logoBlock = branding.logoUrl
    ? `<img src="${escapeHtml(branding.logoUrl)}" alt="${brand}" width="120" style="display:block;max-width:120px;height:auto;border:0;" />`
    : `<div style="font-size:11px;letter-spacing:0.28em;text-transform:uppercase;font-weight:700;color:#ffffff;">${brand}</div>`

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>Lembrete de assinatura</title>
</head>
<body style="margin:0;padding:0;background-color:#eef1f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#eef1f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 12px 40px rgba(15,37,69,0.12);">
          <tr>
            <td style="background:#0f2545;padding:28px 32px 24px;position:relative;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>${logoBlock}</td>
                  <td align="right" style="vertical-align:top;">
                    <span style="display:inline-block;background:#c79b6b;color:#0f2545;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;padding:6px 10px;border-radius:999px;">Assinatura</span>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;font-size:22px;line-height:1.35;font-weight:700;color:#ffffff;">Olá, ${greeting} 👋</p>
              <p style="margin:8px 0 0;font-size:14px;line-height:1.5;color:rgba(255,255,255,0.82);">Preparamos um lembrete sobre o vencimento da sua assinatura${empresa ? ` · ${empresa}` : ""}.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${urgency.accentSoft};border:1px solid ${urgency.border};border-radius:12px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0;font-size:13px;font-weight:700;color:${urgency.accent};text-transform:uppercase;letter-spacing:0.04em;">${escapeHtml(urgency.label)}</p>
                    <p style="margin:6px 0 0;font-size:14px;line-height:1.45;color:#334155;">${escapeHtml(urgency.sub)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
                <tr>
                  <td colspan="2" style="padding:12px 16px;background:#f8fafc;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">Resumo</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;border-top:1px solid #e2e8f0;font-size:13px;color:#64748b;width:38%;">Cliente</td>
                  <td style="padding:12px 16px;border-top:1px solid #e2e8f0;font-size:15px;font-weight:600;color:#0f172a;">${nome}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;border-top:1px solid #e2e8f0;font-size:13px;color:#64748b;">Plano</td>
                  <td style="padding:12px 16px;border-top:1px solid #e2e8f0;font-size:15px;font-weight:600;color:#0f172a;">${plano}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;border-top:1px solid #e2e8f0;font-size:13px;color:#64748b;">Valor</td>
                  <td style="padding:12px 16px;border-top:1px solid #e2e8f0;font-size:18px;font-weight:700;color:#0f2545;">${preco}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;border-top:1px solid #e2e8f0;font-size:13px;color:#64748b;">Vencimento</td>
                  <td style="padding:12px 16px;border-top:1px solid #e2e8f0;font-size:15px;font-weight:600;color:#0f172a;">${vencimento}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;border-top:1px solid #e2e8f0;font-size:13px;color:#64748b;">Grupo</td>
                  <td style="padding:12px 16px;border-top:1px solid #e2e8f0;font-size:15px;color:#0f172a;">${grupo}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 28px;">
              <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">Mensagem</p>
              <div style="font-size:15px;line-height:1.65;color:#334155;background:#fafafa;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;">${bodyHtml}</div>
            </td>
          </tr>
          ${pixHtml}
          <tr>
            <td style="padding:20px 32px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:13px;line-height:1.55;color:#64748b;">Equipe <strong style="color:#0f2545;">${brand}</strong></p>
              ${
                support
                  ? `<p style="margin:8px 0 0;font-size:13px;line-height:1.55;color:#64748b;">Dúvidas? Responda este e-mail ou escreva para <a href="mailto:${support}" style="color:#2563eb;text-decoration:none;font-weight:600;">${support}</a>.</p>`
                  : `<p style="margin:8px 0 0;font-size:13px;line-height:1.55;color:#64748b;">Dúvidas? Responda este e-mail que retornamos em breve.</p>`
              }
              <p style="margin:16px 0 0;font-size:11px;line-height:1.5;color:#94a3b8;">Você recebeu este lembrete porque possui assinatura ativa conosco. Se já realizou o pagamento, desconsidere.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
