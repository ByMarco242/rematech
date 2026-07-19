/**
 * Envío de emails vía Resend (https://resend.com — plan gratuito).
 * Si RESEND_API_KEY no está configurada, devuelve false y el flujo
 * que lo use debe ofrecer una alternativa (ej: contactar al administrador).
 */
export async function sendMail(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  const key = process.env.RESEND_API_KEY || import.meta.env.RESEND_API_KEY;
  if (!key) return false;
  const from =
    process.env.MAIL_FROM || import.meta.env.MAIL_FROM || 'NoteStore <onboarding@resend.dev>';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
