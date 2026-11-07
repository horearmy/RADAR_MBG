import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly transporter: nodemailer.Transporter | null;

  constructor() {
    const host = process.env.SMTP_HOST;
    if (!host) {
      this.transporter = null;
      return;
    }
    this.transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? '' }
        : undefined,
    });
  }

  async sendInvitation(email: string, token: string) {
    const baseUrl = process.env.WEB_BASE_URL ?? 'http://localhost:3000';
    const link = `${baseUrl}/acceptinvitation?token=${encodeURIComponent(token)}`;

    if (!this.transporter) {
      console.warn('[EmailService] SMTP not configured; invitation not sent. Token stored for manual delivery.');
      return;
    }

    await this.transporter.sendMail({
      from: process.env.SMTP_FROM ?? 'no-reply@radar-mbg.local',
      to: email,
      subject: 'Undangan Akun RADAR MBG',
      text: `Anda diundang ke RADAR MBG. Aktifkan akun Anda melalui link berikut: ${link}\n\nLink berlaku terbatas. Jangan bagikan link ini.`,
      html: `<p>Anda diundang ke RADAR MBG.</p><p>Aktifkan akun Anda melalui link berikut:</p><p><a href="${link}">${link}</a></p><p><small>Link berlaku terbatas. Jangan bagikan link ini.</small></p>`,
    });
  }
}
