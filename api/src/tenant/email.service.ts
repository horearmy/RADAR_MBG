import { Injectable } from '@nestjs/common';

@Injectable()
export class EmailService {
  async sendInvitation(email: string, token: string) {
    // Dev: log. Replace with real SMTP/SendGrid in production.
    console.log(`[INVITATION] to=${email} token=${token}`);
  }
}
