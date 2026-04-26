import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { InterviewModule } from './interview/interview.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { BookmarksModule } from './bookmarks/bookmarks.module';
import { AiModule } from './ai/ai.module';
import { NotificationsModule } from './notifications/notifications.module';
import { QuestionsModule } from './questions/questions.module';
import { AppController } from './app.controller';
import { AuthService } from './auth/auth.service';
import { PrismaModule } from './prisma/prisma.module';

function validateEnv(env: Record<string, string | undefined>) {
  const required: string[] = ['DATABASE_URL'];
  if (env.NODE_ENV === 'production') {
    required.push('JWT_SECRET', 'FRONTEND_URL');
  }
  const missing = required.filter((key) => !env[key] || !String(env[key]).trim());
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  if (
    env.NODE_ENV === 'production' &&
    (!env.JWT_SECRET || env.JWT_SECRET === 'dev-insecure-change-me' || env.JWT_SECRET.length < 24)
  ) {
    throw new Error('JWT_SECRET must be set to a strong value in production');
  }
  return env;
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateEnv,
    }),
    PrismaModule,
    AuthModule,
    InterviewModule,
    DashboardModule,
    BookmarksModule,
    AiModule,
    NotificationsModule,
    QuestionsModule,
  ],
  controllers: [AppController],
})
export class AppModule implements OnModuleInit {
  constructor(private readonly authService: AuthService) {}

  async onModuleInit() {
    await this.authService.seedAdmin();
  }
}
