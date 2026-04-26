import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Query,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  HttpException,
  Req,
  UseGuards,
} from '@nestjs/common';
import { QuestionsService } from './questions.service';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('questions')
@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  private assertAdmin(req: any) {
    if (!req?.user || req.user.role !== 'admin') {
      throw new HttpException('Admin access required', HttpStatus.FORBIDDEN);
    }
  }

  @Post()
  @ApiOperation({ summary: 'Create a new question' })
  @ApiResponse({ status: 201, description: 'Question created successfully' })
  async createQuestion(@Body() questionData: any) {
    return this.questionsService.createQuestion(questionData);
  }

  @Get()
  @ApiOperation({ summary: 'Get questions with optional filters' })
  @ApiQuery({ name: 'stack', required: false, description: 'Technology stack (e.g. angular, nodejs)' })
  @ApiQuery({ name: 'tech_stack', required: false, description: 'Legacy alias for stack' })
  @ApiQuery({ name: 'difficulty', required: false })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of random questions to return' })
  async getQuestions(@Query() filters: any) {
    try {
      if (!filters.stack && filters.tech_stack) filters.stack = filters.tech_stack;
      return await this.questionsService.getQuestions(filters);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(`Failed to fetch questions: ${error.message}`, 500);
    }
  }

  @Get('random')
  @ApiOperation({ summary: 'Get random questions for a tech stack and difficulty' })
  @ApiQuery({ name: 'tech_stack', required: false })
  @ApiQuery({ name: 'stack', required: false, description: 'Alias for tech_stack' })
  @ApiQuery({ name: 'difficulty', required: true })
  @ApiQuery({ name: 'count', required: true })
  @ApiQuery({ name: 'excludeIds', required: false })
  async getRandomQuestions(@Query() filters: any) {
    if (filters.stack && !filters.tech_stack) {
      filters.tech_stack = filters.stack;
    }
    return this.questionsService.getRandomQuestions(filters);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get question statistics' })
  async getStats() {
    return this.questionsService.getQuestionStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get question by ID' })
  async getQuestionById(@Param('id') id: string) {
    return this.questionsService.getQuestionById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update question' })
  async updateQuestion(@Param('id') id: string, @Body() updateData: any) {
    return this.questionsService.updateQuestion(id, updateData);
  }

  @Put(':id/coding-assets')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update coding template and test cases for a question (admin only)' })
  async updateCodingAssets(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    this.assertAdmin(req);
    return this.questionsService.updateCodingAssets(id, {
      coding_template: body?.coding_template ?? null,
      coding_test_cases: body?.coding_test_cases ?? null,
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete question (soft delete)' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteQuestion(@Param('id') id: string) {
    await this.questionsService.deleteQuestion(id);
  }

  @Post('seed')
  @ApiOperation({ summary: 'Seed database with sample questions' })
  async seedQuestions() {
    await this.questionsService.seedQuestions();
    return { message: 'Questions seeded successfully' };
  }
}
