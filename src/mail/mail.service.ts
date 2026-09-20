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
  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >

  <meta
    name="color-scheme"
    content="light"
  >

  <meta
    name="supported-color-schemes"
    content="light"
  >

  <title>Welcome to Stock Management System</title>
</head>

<body
  style="
    margin:0;
    padding:0;
    background-color:#f4f6f8;
    font-family:Arial, Helvetica, sans-serif;
  "
>

<table
  width="100%"
  cellpadding="0"
  cellspacing="0"
  border="0"
  style="
    background-color:#f4f6f8;
    padding:30px 15px;
  "
>
  <tr>
    <td align="center">

      <!-- MAIN CARD -->
      <table
        width="100%"
        cellpadding="0"
        cellspacing="0"
        border="0"
        style="
          max-width:600px;
          background-color:#ffffff;
          border:1px solid #e5e7eb;
          border-radius:10px;
        "
      >

        <tr>
          <td
            style="
              padding:32px 36px;
              background-color:#ffffff;
            "
          >

            <!-- BRAND -->
            <p
              style="
                margin:0 0 18px 0;
                font-size:12px;
                line-height:18px;
                font-weight:700;
                letter-spacing:0.8px;
                color:#2563eb;
              "
            >
              STOCK MANAGEMENT SYSTEM
            </p>


            <!-- TITLE -->
            <h1
              style="
                margin:0 0 18px 0;
                font-size:26px;
                line-height:34px;
                font-weight:700;
                color:#1f2937;
              "
            >
              Welcome to Stock Management!
            </h1>


            <!-- GREETING -->
            <p
              style="
                margin:0 0 12px 0;
                font-size:15px;
                line-height:24px;
                color:#374151;
              "
            >
              Hello
              <strong style="color:#111827;">
                ${firstName} ${lastName}
              </strong>,
            </p>


            <!-- DESCRIPTION -->
            <p
              style="
                margin:0 0 20px 0;
                font-size:14px;
                line-height:23px;
                color:#6b7280;
              "
            >
              Your Stock Management System account has been
              successfully created. Please use the credentials
              below to log in.
            </p>


            <!-- CREDENTIAL BOX -->
            <table
              width="100%"
              cellpadding="0"
              cellspacing="0"
              border="0"
              style="
                background-color:#f8fafc;
                border:1px solid #e2e8f0;
                border-left:4px solid #2563eb;
                border-radius:7px;
                margin:0 0 20px 0;
              "
            >

              <tr>
                <td
                  style="
                    padding:16px 18px;
                    background-color:#f8fafc;
                  "
                >

                  <p
                    style="
                      margin:0 0 9px 0;
                      font-size:14px;
                      line-height:22px;
                      color:#6b7280;
                    "
                  >
                    <strong style="color:#374151;">
                      Staff ID:
                    </strong>

                    <span
                      style="
                        color:#111827;
                        margin-left:6px;
                      "
                    >
                      ${staffId}
                    </span>
                  </p>


                  <p
                    style="
                      margin:0;
                      font-size:14px;
                      line-height:22px;
                      color:#6b7280;
                    "
                  >
                    <strong style="color:#374151;">
                      Password:
                    </strong>

                    <span
                      style="
                        color:#111827;
                        margin-left:6px;
                      "
                    >
                      ${temporaryPassword}
                    </span>
                  </p>

                </td>
              </tr>

            </table>


            <!-- SECURITY REMINDER -->
            <table
              width="100%"
              cellpadding="0"
              cellspacing="0"
              border="0"
              style="
                background-color:#f0fdf4;
                border:1px solid #bbf7d0;
                border-radius:7px;
                margin:0 0 20px 0;
              "
            >

              <tr>
                <td
                  style="
                    padding:15px 17px;
                    background-color:#f0fdf4;
                  "
                >

                  <p
                    style="
                      margin:0;
                      font-size:13px;
                      line-height:21px;
                      color:#166534;
                    "
                  >
                    <strong style="color:#15803d;">
                      Security Reminder:
                    </strong>

                    You will be required to change this
                    temporary password immediately after
                    your first login.
                  </p>

                </td>
              </tr>

            </table>


            <!-- FOOTER -->
            <p
              style="
                margin:0 0 15px 0;
                font-size:12px;
                line-height:19px;
                color:#9ca3af;
              "
            >
              If you did not expect this account to be created,
              please contact your system administrator.
            </p>


            <!-- COPYRIGHT -->
            <p
              style="
                margin:0;
                font-size:11px;
                line-height:17px;
                color:#9ca3af;
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
