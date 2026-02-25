import nodemailer, { type Transporter } from 'nodemailer';

interface MailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string | null;
  pass: string | null;
  from: string;
}

interface SendAdminOtpEmailInput {
  toName: string;
  toEmail: string;
  otp: string;
  expiresAt: Date;
}

let cachedTransporter: Transporter | null = null;
let cachedConfig: MailConfig | null = null;

const parsePort = (rawPort: string): number => {
  const parsed = Number(rawPort);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error('Invalid ADMIN_SMTP_PORT value.');
  }

  return parsed;
};

const parseSecure = (rawSecure: string | undefined): boolean => {
  if (!rawSecure) {
    return false;
  }

  return rawSecure.toLowerCase() === 'true';
};

const readMailConfig = (): MailConfig | null => {
  const host = process.env.ADMIN_SMTP_HOST?.trim();
  const rawPort = process.env.ADMIN_SMTP_PORT?.trim();
  const from = process.env.ADMIN_SMTP_FROM?.trim();

  if (!host && !rawPort && !from) {
    return null;
  }

  if (!host || !rawPort || !from) {
    throw new Error('Admin OTP email is not fully configured. Set ADMIN_SMTP_HOST, ADMIN_SMTP_PORT, and ADMIN_SMTP_FROM.');
  }

  const user = process.env.ADMIN_SMTP_USER?.trim() || null;
  const pass = process.env.ADMIN_SMTP_PASS?.trim() || null;

  if ((user && !pass) || (!user && pass)) {
    throw new Error('ADMIN_SMTP_USER and ADMIN_SMTP_PASS must be set together.');
  }

  return {
    host,
    port: parsePort(rawPort),
    secure: parseSecure(process.env.ADMIN_SMTP_SECURE),
    user,
    pass,
    from,
  };
};

const getTransporter = (): { transporter: Transporter; config: MailConfig } => {
  if (cachedTransporter && cachedConfig) {
    return {
      transporter: cachedTransporter,
      config: cachedConfig,
    };
  }

  const config = readMailConfig();
  if (!config) {
    throw new Error('Admin OTP email is not configured. Set ADMIN_SMTP_* environment variables.');
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user && config.pass
      ? {
        user: config.user,
        pass: config.pass,
      }
      : undefined,
  });

  cachedConfig = config;
  cachedTransporter = transporter;

  return {
    transporter,
    config,
  };
};

export const sendAdminOtpEmail = async (input: SendAdminOtpEmailInput): Promise<void> => {
  const { transporter, config } = getTransporter();

  const expiryIso = input.expiresAt.toISOString();
  await transporter.sendMail({
    from: config.from,
    to: `${input.toName} <${input.toEmail}>`,
    subject: 'MIDI Invaders admin login code',
    text: [
      `Hi ${input.toName},`,
      '',
      `Your MIDI Invaders admin login OTP is: ${input.otp}`,
      `This code expires at ${expiryIso}.`,
      '',
      'If you did not request this code, you can ignore this email.',
    ].join('\n'),
  });
};
