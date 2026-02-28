/**
 * Nodemailer(SMTP) 메일 발송
 * 환경 변수: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_SECURE
 */

import nodemailer from 'nodemailer';

function isConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER);
}

let transporter = null;

function getTransporter() {
  if (!isConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === '1' || process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS || '',
      },
    });
  }
  return transporter;
}

/**
 * 이메일 발송. to는 단일 주소 또는 주소 배열.
 */
export async function sendMail(to, subject, text, html = null) {
  const trans = getTransporter();
  if (!trans) {
    console.warn('SMTP 미설정: .env에 SMTP_HOST, SMTP_USER 등 설정 필요');
    return { ok: false, message: '메일 발송이 설정되지 않았습니다.' };
  }
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const toList = Array.isArray(to) ? to : [to];
  try {
    const info = await trans.sendMail({
      from,
      to: toList.join(', '),
      subject,
      text: text || '',
      html: html || undefined,
    });
    return { ok: true, id: info.messageId };
  } catch (e) {
    console.warn('메일 발송 실패:', e.message);
    return { ok: false, message: e.message || '메일 발송 중 오류가 발생했습니다.' };
  }
}

export { isConfigured as isMailConfigured };
