import { Controller, Post, Get, Body, Req, Res, HttpException, Query } from '@nestjs/common';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { Request, Response } from 'express';

class RegisterDto {
  @IsEmail() email: string;
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/, {
    message:
      'Password must include at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  password: string;
  @IsString() @MinLength(2) @MaxLength(80) name: string;
}

class LoginDto {
  @IsEmail() email: string;
  @IsString() @MinLength(8) password: string;
}

class VerifyEmailDto {
  @IsString() token: string;
}

class ResendVerificationDto {
  @IsEmail() email: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.email, dto.password, dto.name);
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.authService.login(dto.email, dto.password);
    this.authService.setAuthCookies(res, user.id, user.email);
    return user;
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });
    return { message: 'Logged out' };
  }

  @Get('me')
  async me(@Req() req: Request) {
    const token =
      req.cookies?.access_token || req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) throw new HttpException('Not authenticated', 401);
    const user = await this.authService.getUserFromToken(token);
    if (!user) throw new HttpException('Not authenticated', 401);
    return user;
  }

  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.refresh_token;
    if (!token) throw new HttpException('No refresh token', 401);
    try {
      const access = await this.authService.refreshAccessToken(token);
      const secure = this.authService.cookieSecure();
      res.cookie('access_token', access, {
        httpOnly: true,
        secure,
        sameSite: 'lax',
        maxAge: 7200000,
        path: '/',
      });
      return { message: 'Token refreshed' };
    } catch {
      throw new HttpException('Invalid refresh token', 401);
    }
  }

  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @Get('verify-email')
  async verifyEmailFromLink(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Post('resend-verification')
  async resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerificationEmail(dto.email);
  }
}
