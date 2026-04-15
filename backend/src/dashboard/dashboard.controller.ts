import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('dashboard/overview')
  overview() {
    return this.dashboardService.overview();
  }

  @Get('dashboard/skill-radar')
  skillRadar() {
    return this.dashboardService.skillRadar();
  }

  @Get('dashboard/trend')
  trend() {
    return this.dashboardService.trend();
  }

  @Get('dashboard/category-stats')
  categoryStats() {
    return this.dashboardService.categoryStats();
  }

  @Get('dashboard/weak-topics')
  weakTopics() {
    return this.dashboardService.weakTopics();
  }

  @Get('comparison')
  comparison(@Query('session1') s1: string, @Query('session2') s2: string) {
    return this.dashboardService.comparison(s1, s2);
  }

  @Get('leaderboard')
  leaderboard(@Query('limit') limit?: string) {
    return this.dashboardService.leaderboard(limit ? parseInt(limit) : 20);
  }

  @Get('coach/study-plan')
  studyPlan() {
    return this.dashboardService.studyPlan();
  }
}
