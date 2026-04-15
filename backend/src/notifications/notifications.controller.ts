import { Controller, Get, Post, Param, Query, Req, HttpException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { Request } from 'express';
import { AuthService } from '../auth/auth.service';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifService: NotificationsService,
    private readonly authService: AuthService,
  ) {}

  private async getUserId(req: Request): Promise<string> {
    const token = req.cookies?.access_token || req.headers.authorization?.replace('Bearer ', '');
    if (!token) throw new HttpException('Not authenticated', 401);
    const user = await this.authService.getUserFromToken(token);
    if (!user) throw new HttpException('Not authenticated', 401);
    return user._id;
  }

  @Get()
  async list(@Req() req: Request, @Query('unread') unread?: string): Promise<any> {
    const userId = await this.getUserId(req);
    return this.notifService.list(userId, unread === 'true');
  }

  @Get('count')
  async unreadCount(@Req() req: Request): Promise<any> {
    const userId = await this.getUserId(req);
    const count = await this.notifService.unreadCount(userId);
    return { count };
  }

  @Post(':id/read')
  async markRead(@Param('id') id: string): Promise<any> {
    return this.notifService.markRead(id);
  }

  @Post('mark-all-read')
  async markAllRead(@Req() req: Request): Promise<any> {
    const userId = await this.getUserId(req);
    return this.notifService.markAllRead(userId);
  }

  @Post('weekly-summary')
  async weeklySummary(@Req() req: Request): Promise<any> {
    const userId = await this.getUserId(req);
    return this.notifService.generateWeeklySummary(userId);
  }
}
