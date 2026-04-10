import nodemailer from 'nodemailer';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
}

function createTransport() {
  const host = process.env['SMTP_HOST'];
  const port = Number(process.env['SMTP_PORT'] ?? 587);
  const user = process.env['SMTP_USER'];
  const pass = process.env['SMTP_PASS'];

  if (!host || !user || !pass) {
    // Development: use Ethereal (auto-generated test account would require async init;
    // instead just log the email so devs see it without needing an SMTP server)
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

const FROM_NAME = process.env['EMAIL_FROM_NAME'] ?? 'SankoERP';
const FROM_EMAIL = process.env['EMAIL_FROM'] ?? 'noreply@sankoerp.com';

/**
 * Send an email. In development (no SMTP configured), logs to console.
 * Returns true on success, false on failure.
 */
export async function sendEmail(opts: EmailOptions): Promise<boolean> {
  const transport = createTransport();

  if (!transport) {
    console.log('[Email] SMTP not configured. Would have sent:');
    console.log(`  To: ${Array.isArray(opts.to) ? opts.to.join(', ') : opts.to}`);
    console.log(`  Subject: ${opts.subject}`);
    return true;
  }

  try {
    await transport.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: Array.isArray(opts.to) ? opts.to.join(', ') : opts.to,
      subject: opts.subject,
      html: opts.html,
      attachments: opts.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });
    return true;
  } catch (err) {
    console.error('[Email] Failed to send email:', err);
    return false;
  }
}

// ---- Email templates ----

export function invoiceEmailHtml(invoiceCode: string, clientName: string, amount: string, dueDate: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1976D2; padding: 20px; color: white;">
        <h2 style="margin:0">Invoice ${invoiceCode}</h2>
      </div>
      <div style="padding: 20px;">
        <p>Dear ${clientName},</p>
        <p>Please find attached your invoice <strong>${invoiceCode}</strong> for <strong>${amount}</strong>.</p>
        <p>Payment is due by <strong>${dueDate}</strong>.</p>
        <p>If you have any questions, please contact us.</p>
        <p>Thank you for your business.</p>
        <hr/>
        <p style="color: #666; font-size: 12px;">SankoERP &mdash; Construction & Manpower Management</p>
      </div>
    </div>
  `;
}

export function leaveApprovalEmailHtml(employeeName: string, leaveType: string, startDate: string, endDate: string, status: 'APPROVED' | 'REJECTED', reason?: string): string {
  const color = status === 'APPROVED' ? '#2e7d32' : '#c62828';
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: ${color}; padding: 20px; color: white;">
        <h2 style="margin:0">Leave Request ${status}</h2>
      </div>
      <div style="padding: 20px;">
        <p>Dear ${employeeName},</p>
        <p>Your <strong>${leaveType}</strong> leave request from <strong>${startDate}</strong> to <strong>${endDate}</strong>
        has been <strong>${status.toLowerCase()}</strong>.</p>
        ${reason ? `<p>Reason: ${reason}</p>` : ''}
        <hr/>
        <p style="color: #666; font-size: 12px;">SankoERP HR System</p>
      </div>
    </div>
  `;
}

export function workPassExpiryEmailHtml(employeeName: string, passType: string, passNumber: string, expiryDate: string, daysLeft: number): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #e65100; padding: 20px; color: white;">
        <h2 style="margin:0">Work Pass Expiry Alert</h2>
      </div>
      <div style="padding: 20px;">
        <p>This is a reminder that the work pass for <strong>${employeeName}</strong> is expiring soon.</p>
        <table style="border-collapse: collapse; width: 100%;">
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Pass Type</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${passType}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Pass Number</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${passNumber}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Expiry Date</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${expiryDate}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Days Remaining</strong></td><td style="padding: 8px; border: 1px solid #ddd; color: ${daysLeft <= 7 ? '#c62828' : '#e65100'};">${daysLeft} days</td></tr>
        </table>
        <p>Please take immediate action to renew this work pass.</p>
        <hr/>
        <p style="color: #666; font-size: 12px;">SankoERP Compliance System</p>
      </div>
    </div>
  `;
}

export function passwordResetEmailHtml(resetLink: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1976D2; padding: 20px; color: white;">
        <h2 style="margin:0">Password Reset Request</h2>
      </div>
      <div style="padding: 20px;">
        <p>You requested a password reset for your SankoERP account.</p>
        <p>Click the button below to reset your password. This link expires in 1 hour.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background: #1976D2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Reset Password</a>
        </div>
        <p>If you didn't request this, you can safely ignore this email.</p>
        <hr/>
        <p style="color: #666; font-size: 12px;">SankoERP &mdash; This link expires in 1 hour.</p>
      </div>
    </div>
  `;
}
