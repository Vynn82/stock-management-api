import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT),
    secure: process.env.MAIL_SECURE === 'true',

    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASSWORD,
    },
  });

  async sendWelcomeEmail(
    email: string,
    firstName: string,
    staffId: string,
    temporaryPassword: string,
  ) {
    await this.transporter.sendMail({
      from: `"Stock Management System" <${process.env.MAIL_USER}>`,
      to: email,

      subject: 'Your Stock Management System Account',

      html: `
        <h2>Welcome, ${firstName}</h2>

        <p>Your account has been created.</p>

        <p><strong>Staff ID:</strong> ${staffId}</p>

        <p>
          <strong>Temporary Password:</strong>
          ${temporaryPassword}
        </p>

        <p>
          Please log in and change your password immediately.
        </p>
      `,
    });
  }
}
