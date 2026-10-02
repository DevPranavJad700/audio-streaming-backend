const nodemailer = require("nodemailer");
const logger = require("../utils/logger");

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: Number(SMTP_PORT) === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }

  return transporter;
}

/**
 * Sends a password reset email to the recipient.
 * If SMTP is not configured or in test environment, logs the reset link safely.
 *
 * @param {{ to: string, resetToken: string, resetUrl: string }} options
 * @returns {Promise<{ delivered: boolean, preview?: string }>}
 */
async function sendPasswordResetEmail({ to, resetToken, resetUrl }) {
  const mailer = getTransporter();
  const isTest = process.env.NODE_ENV === "test";

  const subject = "Reset Your RBAS Password";
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
          .container { max-width: 560px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 32px; border: 1px solid #334155; }
          .logo { font-size: 24px; font-weight: 700; color: #38bdf8; margin-bottom: 24px; }
          h2 { color: #f8fafc; font-size: 20px; margin-top: 0; }
          p { color: #94a3b8; font-size: 15px; line-height: 1.6; }
          .btn { display: inline-block; background: #2563eb; color: #ffffff !important; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 20px 0; }
          .token-box { background: #0f172a; padding: 12px; border-radius: 6px; font-family: monospace; color: #38bdf8; word-break: break-all; margin: 16px 0; }
          .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #334155; font-size: 13px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">🎵 RBAS Music</div>
          <h2>Password Reset Request</h2>
          <p>We received a request to reset your password. Click the button below to choose a new password:</p>
          <a class="btn" href="${resetUrl}" target="_blank" rel="noopener noreferrer">Reset Password</a>
          <p>Or use this reset token directly in your API client / frontend application:</p>
          <div class="token-box">${resetToken}</div>
          <p>This link and token are valid for <strong>15 minutes</strong>. If you did not request this, you can safely ignore this email.</p>
          <div class="footer">
            RBAS &bull; Role-Based Audio Streaming Platform
          </div>
        </div>
      </body>
    </html>
  `;

  if (!mailer || isTest) {
    logger.info(
      `[EmailService] Password reset token generated for ${to}: ${resetToken} (Reset URL: ${resetUrl})`,
    );
    return { delivered: false, preview: resetUrl, token: resetToken };
  }

  try {
    const info = await mailer.sendMail({
      from: process.env.EMAIL_FROM || '"RBAS Security" <no-reply@rbas.app>',
      to,
      subject,
      text: `Reset your RBAS password using the following token: ${resetToken}\nOr visit: ${resetUrl}\nValid for 15 minutes.`,
      html,
    });
    logger.info(`[EmailService] Password reset email sent to ${to}: ${info.messageId}`);
    return { delivered: true, messageId: info.messageId };
  } catch (error) {
    logger.error(`[EmailService] Failed to send email to ${to}:`, error);
    // We do not rethrow to avoid leaking transport errors to users
    return { delivered: false, error: error.message };
  }
}

module.exports = {
  sendPasswordResetEmail,
};
