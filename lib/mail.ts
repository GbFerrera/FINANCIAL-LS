import nodemailer from "nodemailer"

export function getSmtpConfig() {
  const smtpHost = process.env.SMTP_HOST
  const smtpPort = Number(process.env.SMTP_PORT || 587)
  const smtpSecure = process.env.SMTP_SECURE === "true"
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS
  const smtpFrom = process.env.SMTP_FROM || smtpUser

  if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom) {
    return null
  }

  return { smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass, smtpFrom }
}

export async function sendMail(input: {
  to: string
  subject: string
  text: string
  html?: string
}) {
  const cfg = getSmtpConfig()
  if (!cfg) {
    throw new Error("SMTP não configurado (SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM)")
  }

  const transporter = nodemailer.createTransport({
    host: cfg.smtpHost,
    port: cfg.smtpPort,
    secure: cfg.smtpSecure,
    auth: { user: cfg.smtpUser, pass: cfg.smtpPass },
  })

  await transporter.sendMail({
    from: cfg.smtpFrom,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html ?? input.text.replace(/\n/g, "<br/>"),
  })
}
