import { Injectable, HttpException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '../schemas/user.schema';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private jwtService: JwtService,
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

  setAuthCookies(res: any, userId: string, email: string) {
    res.cookie('access_token', this.createAccessToken(userId, email), {
      httpOnly: true, secure: false, sameSite: 'lax', maxAge: 7200000, path: '/',
    });
    res.cookie('refresh_token', this.createRefreshToken(userId), {
      httpOnly: true, secure: false, sameSite: 'lax', maxAge: 604800000, path: '/',
    });
  }

  async register(email: string, password: string, name: string) {
    email = email.toLowerCase().trim();
    if (password.length < 6) throw new HttpException('Password must be at least 6 characters', 400);
    const existing = await this.userModel.findOne({ email });
    if (existing) throw new HttpException('Email already registered', 400);
    const user = await this.userModel.create({
      email, password_hash: this.hashPassword(password), name: name.trim(), role: 'user',
      created_at: new Date().toISOString(),
    });
    return { id: user._id.toString(), email: user.email, name: user.name, role: user.role };
  }

  async login(email: string, password: string) {
    email = email.toLowerCase().trim();
    const user = await this.userModel.findOne({ email });
    if (!user || !this.verifyPassword(password, user.password_hash)) {
      throw new HttpException('Invalid email or password', 401);
    }
    return { id: user._id.toString(), email: user.email, name: user.name, role: user.role };
  }

  async getUserFromToken(token: string) {
    try {
      const payload = this.jwtService.verify(token);
      if (payload.type !== 'access') throw new Error('Invalid token type');
      const user = await this.userModel.findById(payload.sub);
      if (!user) throw new Error('User not found');
      return { _id: user._id.toString(), email: user.email, name: user.name, role: user.role };
    } catch {
      return null;
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<string> {
    const payload = this.jwtService.verify(refreshToken);
    if (payload.type !== 'refresh') throw new HttpException('Invalid token type', 401);
    const user = await this.userModel.findById(payload.sub);
    if (!user) throw new HttpException('User not found', 401);
    return this.createAccessToken(user._id.toString(), user.email);
  }

  async seedAdmin() {
    const email = (process.env.ADMIN_EMAIL || 'test@devgrill.com').toLowerCase();
    const password = process.env.ADMIN_PASSWORD || 'test';
    const existing = await this.userModel.findOne({ email });
    if (!existing) {
      await this.userModel.create({
        email, password_hash: this.hashPassword(password), name: 'Admin', role: 'admin',
        created_at: new Date().toISOString(),
      });
    } else if (!this.verifyPassword(password, existing.password_hash)) {
      await this.userModel.updateOne({ email }, { $set: { password_hash: this.hashPassword(password) } });
    }
    await this.userModel.collection.createIndex({ email: 1 }, { unique: true }).catch(() => {});
  }
}
