import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('dashboard/overview')
  @UseGuards(JwtAuthGuard)
  overview(@Req() req: Request) {
    return this.dashboardService.overview((req as any).user._id);
  }

  @Get('dashboard/skill-radar')
  @UseGuards(JwtAuthGuard)
  skillRadar(@Req() req: Request) {
    return this.dashboardService.skillRadar((req as any).user._id);
  }

  @Get('dashboard/trend')
  @UseGuards(JwtAuthGuard)
  trend(@Req() req: Request) {
    return this.dashboardService.trend((req as any).user._id);
  }

  @Get('dashboard/category-stats')
  @UseGuards(JwtAuthGuard)
  categoryStats(@Req() req: Request) {
    return this.dashboardService.categoryStats((req as any).user._id);
  }

  @Get('dashboard/weak-topics')
  @UseGuards(JwtAuthGuard)
  weakTopics(@Req() req: Request) {
    return this.dashboardService.weakTopics((req as any).user._id);
  }

  @Get('comparison')
  @UseGuards(JwtAuthGuard)
  comparison(@Req() req: Request, @Query('session1') s1: string, @Query('session2') s2: string) {
    return this.dashboardService.comparison(s1, s2, (req as any).user._id);
  }

  @Get('leaderboard')
  leaderboard(@Query('limit') limit?: string) {
    return this.dashboardService.leaderboard(limit ? parseInt(limit, 10) : 20);
  }

  @Get('coach/study-plan')
  @UseGuards(JwtAuthGuard)
  studyPlan(@Req() req: Request) {
    return this.dashboardService.studyPlan((req as any).user._id);
  }
}
