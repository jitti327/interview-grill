import { Controller, Post, Get, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { InterviewService } from './interview.service';
import { OptionalAuthGuard } from '../auth/jwt.guard';
import { Request } from 'express';

class CreateSessionDto {
  @IsString() tech_stack: string;
  @IsString() category: string;
  @IsString() difficulty: string;
  @IsOptional() @IsNumber() @Type(() => Number) num_questions?: number;
  @IsOptional() @IsBoolean() timed_mode?: boolean;
  @IsOptional() @IsNumber() @Type(() => Number) time_per_question?: number;
}

class QuestionRequestDto {
  @IsString() session_id: string;
}

class AnswerSubmitDto {
  @IsString() session_id: string;
  @IsString() round_id: string;
  @IsString() answer: string;
}

@Controller()
export class InterviewController {
  constructor(private readonly interviewService: InterviewService) {}

  @Post('sessions')
  @UseGuards(OptionalAuthGuard)
  createSession(@Body() dto: CreateSessionDto, @Req() req: Request): Promise<any> {
    return this.interviewService.createSession(dto, (req as any).user?._id);
  }

  @Get('sessions')
  listSessions(@Query('status') status?: string, @Query('limit') limit?: string): Promise<any> {
    return this.interviewService.listSessions(status, limit ? parseInt(limit) : 50);
  }

  @Get('sessions/:sessionId')
  getSession(@Param('sessionId') sessionId: string): Promise<any> {
    return this.interviewService.getSession(sessionId);
  }

  @Post('interview/question')
  generateQuestion(@Body() dto: QuestionRequestDto): Promise<any> {
    return this.interviewService.generateQuestion(dto.session_id);
  }

  @Post('interview/evaluate')
  evaluateAnswer(@Body() dto: AnswerSubmitDto): Promise<any> {
    return this.interviewService.evaluateAnswer(dto.session_id, dto.round_id, dto.answer);
  }

  @Post('sessions/:sessionId/complete')
  completeSession(@Param('sessionId') sessionId: string): Promise<any> {
    return this.interviewService.completeSession(sessionId);
  }
}
