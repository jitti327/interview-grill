import { Controller, Get, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  root() {
    return { message: 'DevGrill AI API - Interview Preparation Platform' };
  }

  @Get('_debug/db')
  async debugDb() {
    if (process.env.ENABLE_DB_DEBUG !== 'true') {
      throw new NotFoundException();
    }
    return { ok: true, message: 'Database reachable' };
  }
}
