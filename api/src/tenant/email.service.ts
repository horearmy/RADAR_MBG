import { Injectable } from '@nestjs/common';

@Injectable()
export class EmailService {
  async sendInvitation(email: string, token: string) {
    // Production: integrasikan dengan SMTP/SendGrid/SES.
    // Token tidak boleh dicetak ke log. Simpan hanya status pengiriman.
    void email;
    void token;
  }
}
