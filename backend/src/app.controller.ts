import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  root() {
    return { message: 'DevGrill AI API - Interview Preparation Platform' };
  }
}
