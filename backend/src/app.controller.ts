import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Controller()
export class AppController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get()
  root() {
    return { message: 'DevGrill AI API - Interview Preparation Platform' };
  }

  @Get('_debug/db')
  debugDb() {
    const c: any = this.connection;
    return {
      readyState: c?.readyState,
      dbName: c?.name,
      host: c?.host,
      port: c?.port,
    };
  }
}
