import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import * as express from 'express';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const isProd = configService.get<string>('NODE_ENV') === 'production';
  const port = Number(configService.get<string>('PORT') || 8001);
  const frontendUrl = configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
  const swaggerEnabled = !isProd || configService.get<string>('ENABLE_SWAGGER') === 'true';

  app.setGlobalPrefix('api');
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);
  expressApp.disable('x-powered-by');
  app.enableShutdownHooks();
  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );
  app.use(cookieParser());
  app.enableCors({
    origin: [frontendUrl],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Secret'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('DevGrill AI API')
      .setDescription('AI-Powered Interview Preparation Platform')
      .setVersion('1.0')
      .addCookieAuth('access_token')
      .build();
    const doc = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, doc);
  }

  await app.listen(port, '0.0.0.0');
  console.log(`DevGrill API running on http://0.0.0.0:${port}`);
  if (swaggerEnabled) {
    console.log(`Swagger docs at http://0.0.0.0:${port}/api/docs`);
  }
}
bootstrap();
