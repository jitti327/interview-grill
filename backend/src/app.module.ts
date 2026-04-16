import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { InterviewModule } from './interview/interview.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { BookmarksModule } from './bookmarks/bookmarks.module';
import { AiModule } from './ai/ai.module';
import { NotificationsModule } from './notifications/notifications.module';
import { QuestionsModule } from './questions/questions.module';
import { AppController } from './app.controller';
import { AuthService } from './auth/auth.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // Defaults make local dev + seeding deterministic even without a .env file.
        uri: config.get<string>('MONGO_URL') || 'mongodb://127.0.0.1:27017',
        // Keep default aligned with the commonly-used local DB name in this repo.
        dbName: config.get<string>('DB_NAME') || 'devgrill',
      }),
    }),
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
    console.log('Admin seeded successfully');
  }
}
