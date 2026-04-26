import { Injectable, HttpException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  hashPassword(password: string): string {
    return bcrypt.hashSync(password, 10);
  }

  verifyPassword(plain: string, hash: string): boolean {
    return bcrypt.compareSync(plain, hash);
  }

  createAccessToken(userId: string, email: string): string {
    return this.jwtService.sign({ sub: userId, email, type: 'access' }, { expiresIn: '2h' });
  }

  createRefreshToken(userId: string): string {
    return this.jwtService.sign({ sub: userId, type: 'refresh' }, { expiresIn: '7d' });
  }

  cookieSecure(): boolean {
    return process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true';
  }

  private frontendUrl(): string {
    return this.cleanEnvValue(process.env.FRONTEND_URL) || 'http://localhost:3000';
  }

  private buildVerificationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private cleanEnvValue(value?: string): string {
    let out = (value || '').trim();
    while (
      (out.startsWith('"') && out.endsWith('"')) ||
      (out.startsWith("'") && out.endsWith("'"))
    ) {
      out = out.slice(1, -1).trim();
    }
    return out;
  }

  private async sendVerificationEmail(email: string, name: string, token: string): Promise<boolean> {
    const smtpHost = this.cleanEnvValue(process.env.SMTP_HOST);
    const smtpPort = Number(this.cleanEnvValue(process.env.SMTP_PORT) || 587);
    const smtpUser = this.cleanEnvValue(process.env.SMTP_USER);
    const smtpPass = this.cleanEnvValue(process.env.SMTP_PASS);
    const smtpFrom = this.cleanEnvValue(process.env.SMTP_FROM) || smtpUser;
    const verifyUrl = `${this.frontendUrl().replace(/\/$/, '')}/verify-email?token=${token}`;

    if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom) {
      console.warn(
        `Email verification not sent for ${email}: SMTP config missing. Verification link: ${verifyUrl}`,
      );
      return false;
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });
    await transporter.verify();
    const info = await transporter.sendMail({
      from: smtpFrom,
      to: email,
      subject: 'Verify your DevGrill account',
      html: `<p>Hi ${name || 'there'},</p>
             <p>Thanks for registering with DevGrill. Please verify your email by clicking the link below:</p>
             <p><a href="${verifyUrl}">Verify Email</a></p>
             <p>If you did not create this account, you can ignore this email.</p>`,
    });
    const accepted = Array.isArray(info.accepted) ? info.accepted : [];
    const rejected = Array.isArray(info.rejected) ? info.rejected : [];
    if (!accepted.includes(email) || rejected.includes(email)) {
      console.warn(
        `Verification email was not accepted for ${email}. accepted=${JSON.stringify(
          accepted,
        )} rejected=${JSON.stringify(rejected)}`,
      );
      return false;
    }
    return true;
  }

  setAuthCookies(res: any, userId: string, email: string) {
    const secure = this.cookieSecure();
    res.cookie('access_token', this.createAccessToken(userId, email), {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: 7200000,
      path: '/',
    });
    res.cookie('refresh_token', this.createRefreshToken(userId), {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: 604800000,
      path: '/',
    });
  }

  async register(email: string, password: string, name: string) {
    email = email.toLowerCase().trim();
    name = name.trim();
    if (name.length < 2) throw new HttpException('Name must be at least 2 characters', 400);
    if (password.length < 8) throw new HttpException('Password must be at least 8 characters', 400);
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z\d]/.test(password)) {
      throw new HttpException(
        'Password must include uppercase, lowercase, number, and special character',
        400,
      );
    }
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new HttpException('Email already registered', 400);
    const user = await this.prisma.user.create({
      data: {
        email,
        password_hash: this.hashPassword(password),
        name,
        role: 'user',
        is_email_verified: false,
        email_verification_token: this.buildVerificationToken(),
        email_verification_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    const emailSent = await this.sendVerificationEmail(
      user.email,
      user.name,
      user.email_verification_token || '',
    ).catch((err) => {
      console.warn(`Failed to send verification email to ${user.email}: ${err.message}`);
      return false;
    });
    return {
      message: emailSent
        ? 'Registration successful. Please verify your email before signing in.'
        : 'Registration successful. Email could not be sent; contact support or check SMTP config.',
      email: user.email,
      requires_email_verification: true,
      verification_email_sent: emailSent,
    };
  }

  async login(email: string, password: string) {
    email = email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !this.verifyPassword(password, user.password_hash)) {
      throw new HttpException('Invalid email or password', 401);
    }
    if (!user.is_email_verified) {
      throw new HttpException('Please verify your email before logging in', 403);
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      is_subscriber: user.is_subscriber,
      is_email_verified: user.is_email_verified,
    };
  }

  async verifyEmail(token: string) {
    const cleanToken = token?.trim();
    if (!cleanToken) throw new HttpException('Verification token is required', 400);

    const user = await this.prisma.user.findFirst({
      where: {
        email_verification_token: cleanToken,
        email_verification_expires_at: { gt: new Date() },
      },
    });
    if (!user) throw new HttpException('Invalid or expired verification token', 400);

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        is_email_verified: true,
        email_verification_token: null,
        email_verification_expires_at: null,
      },
    });

    return {
      message: 'Email verified successfully. You can now log in.',
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        role: updated.role,
        is_subscriber: updated.is_subscriber,
        is_email_verified: updated.is_email_verified,
      },
    };
  }

  async resendVerificationEmail(email: string) {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      return { message: 'If the account exists, a verification email has been sent.' };
    }
    if (user.is_email_verified) {
      return { message: 'Email is already verified.' };
    }

    const token = this.buildVerificationToken();
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        email_verification_token: token,
        email_verification_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    const emailSent = await this.sendVerificationEmail(user.email, user.name, token).catch((err) => {
      console.warn(`Failed to resend verification email to ${user.email}: ${err.message}`);
      return false;
    });
    return {
      message: emailSent
        ? 'Verification email sent.'
        : 'Unable to send verification email. Check SMTP config.',
      verification_email_sent: emailSent,
    };
  }

  async getUserFromToken(token: string) {
    try {
      const payload = this.jwtService.verify(token);
      if (payload.type !== 'access') throw new Error('Invalid token type');
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) throw new Error('User not found');
      return {
        _id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        is_subscriber: user.is_subscriber,
        is_email_verified: user.is_email_verified,
      };
    } catch {
      return null;
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<string> {
    const payload = this.jwtService.verify(refreshToken);
    if (payload.type !== 'refresh') throw new HttpException('Invalid token type', 401);
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new HttpException('User not found', 401);
    return this.createAccessToken(user.id, user.email);
  }

  async seedAdmin() {
    const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) {
      return;
    }
    if (process.env.NODE_ENV === 'production' && password.length < 12) {
      throw new HttpException('ADMIN_PASSWORD must be at least 12 characters in production', 500);
    }
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (!existing) {
      await this.prisma.user.create({
        data: {
          email,
          password_hash: this.hashPassword(password),
          name: 'Admin',
          role: 'admin',
          is_subscriber: true,
          is_email_verified: true,
        },
      });
    } else {
      const data: any = {
        role: 'admin',
        is_subscriber: true,
        is_email_verified: true,
      };
      const syncAdminPassword = process.env.ADMIN_PASSWORD_SYNC === 'true';
      if (syncAdminPassword && !this.verifyPassword(password, existing.password_hash)) {
        data.password_hash = this.hashPassword(password);
      }
      await this.prisma.user.update({
        where: { email },
        data,
      });
    }
  }
}
