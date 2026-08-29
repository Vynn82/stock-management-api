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
    lastName: string,
    staffId: string,
    temporaryPassword: string,
  ) {
    await this.transporter.sendMail({
      from: `"Stock Management System" <${process.env.MAIL_USER}>`,
      to: email,

      subject: 'Welcome to Stock Management System',

      html: `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <meta
              name="viewport"
              content="width=device-width, initial-scale=1.0"
            />
          
            <title>Welcome to Stock Management System</title>
          </head>
          
          <body
            style="
              margin: 0;
              padding: 0;
              background-color: #111111;
              font-family: Arial, Helvetica, sans-serif;
              color: #ffffff;
            "
          >
          
            <!-- Main Container -->
            <table
              width="100%"
              cellpadding="0"
              cellspacing="0"
              border="0"
              style="
                background-color: #111111;
                padding: 40px 20px;
              "
            >
              <tr>
                <td align="center">
          
                  <!-- Email Card -->
                  <table
                    width="100%"
                    cellpadding="0"
                    cellspacing="0"
                    border="0"
                    style="
                      max-width: 720px;
                      background-color: #222222;
                      border-radius: 14px;
                      border: 1px solid #3a3a3a;
                      overflow: hidden;
                    "
                  >
                    <tr>
                      <td style="padding: 48px 55px;">
          
                        <!-- Brand -->
                        <div
                          style="
                            font-size: 16px;
                            font-weight: bold;
                            color: #8ab4ff;
                            margin-bottom: 30px;
                            letter-spacing: 0.5px;
                          "
                        >
                          STOCK MANAGEMENT SYSTEM
                        </div>
          
                        <!-- Title -->
                        <h1
                          style="
                            margin: 0 0 32px 0;
                            font-size: 42px;
                            line-height: 1.15;
                            color: #76a9ff;
                            font-weight: 700;
                          "
                        >
                          Welcome to Stock<br />
                          Management!
                        </h1>
          
                        <!-- Greeting -->
                        <p
                          style="
                            margin: 0 0 25px 0;
                            font-size: 23px;
                            line-height: 1.5;
                            color: #ffffff;
                          "
                        >
                          Hello
                          <strong>${firstName} ${lastName}</strong>,
                        </p>
          
                        <!-- Description -->
                        <p
                          style="
                            margin: 0 0 30px 0;
                            font-size: 20px;
                            line-height: 1.55;
                            color: #eeeeee;
                          "
                        >
                          Your Stock Management System account is ready.
                          Please use the following details to log in:
                        </p>
          
                        <!-- Credentials Box -->
                        <table
                          width="100%"
                          cellpadding="0"
                          cellspacing="0"
                          border="0"
                          style="
                            background-color: #2b2b2b;
                            border-radius: 12px;
                            border-left: 6px solid #4f8cff;
                            margin-bottom: 30px;
                          "
                        >
                          <tr>
                            <td style="padding: 28px 32px;">
          
                              <!-- Staff ID -->
                              <p
                                style="
                                  margin: 0 0 18px 0;
                                  font-size: 21px;
                                  line-height: 1.5;
                                  color: #ffffff;
                                "
                              >
                                <strong>Staff ID:</strong>
                                <span style="color: #eeeeee;">
                                  ${staffId}
                                </span>
                              </p>
          
                              <!-- Temporary Password -->
                              <p
                                style="
                                  margin: 0;
                                  font-size: 21px;
                                  line-height: 1.5;
                                  color: #ffffff;
                                "
                              >
                                <strong>Password:</strong>
                                <span style="color: #eeeeee;">
                                  ${temporaryPassword}
                                </span>
                              </p>
          
                            </td>
                          </tr>
                        </table>
          
                        <!-- Security Reminder -->
                        <table
                          width="100%"
                          cellpadding="0"
                          cellspacing="0"
                          border="0"
                          style="
                            background-color: #17271d;
                            border: 1px solid #1d6335;
                            border-radius: 12px;
                            margin-bottom: 35px;
                          "
                        >
                          <tr>
                            <td style="padding: 25px 30px;">
          
                              <p
                                style="
                                  margin: 0;
                                  font-size: 18px;
                                  line-height: 1.6;
                                  color: #8ee5a8;
                                "
                              >
                                <strong>Security Reminder:</strong>
                                For your protection, you will be prompted to
                                change this temporary password immediately
                                upon your first login.
                              </p>
          
                            </td>
                          </tr>
                        </table>
          
                        <!-- Footer Message -->
                        <p
                          style="
                            margin: 0;
                            font-size: 14px;
                            line-height: 1.6;
                            color: #888888;
                          "
                        >
                          If you did not expect this account to be created,
                          please contact your system administrator.
                        </p>
          
                        <!-- Copyright -->
                        <p
                          style="
                            margin: 25px 0 0 0;
                            font-size: 14px;
                            color: #666666;
                          "
                        >
                          © ${new Date().getFullYear()}
                          Stock Management System
                        </p>
          
                      </td>
                    </tr>
                  </table>
          
                </td>
              </tr>
            </table>
          
          </body>
          </html>
          `,
    });
  }
}
