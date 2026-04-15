import { Controller, Post, Get, Param, Body, Query, Req, Res, UseGuards } from '@nestjs/common';
import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { InterviewService } from './interview.service';
import { OptionalAuthGuard } from '../auth/jwt.guard';
import { Request, Response } from 'express';

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
  @UseGuards(OptionalAuthGuard)
  async completeSession(@Param('sessionId') sessionId: string, @Req() req: Request): Promise<any> {
    return this.interviewService.completeSession(sessionId, (req as any).user?._id);
  }

  @Post('interview/evaluate-stream')
  async evaluateStream(@Body() dto: AnswerSubmitDto, @Res() res: Response): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    try {
      res.write(`data: ${JSON.stringify({ type: 'status', text: 'Analyzing your answer...' })}\n\n`);

      const result = await this.interviewService.evaluateAnswer(dto.session_id, dto.round_id, dto.answer);
      const feedback = result.feedback || '';

      for (let i = 0; i < feedback.length; i += 4) {
        const chunk = feedback.slice(i, i + 4);
        res.write(`data: ${JSON.stringify({ type: 'text', text: chunk })}\n\n`);
        await new Promise(r => setTimeout(r, 12));
      }

      res.write(`data: ${JSON.stringify({ type: 'complete', data: result })}\n\n`);
      res.write(`data: [DONE]\n\n`);
    } catch (error) {
      res.write(`data: ${JSON.stringify({ type: 'error', text: error.message || 'Evaluation failed' })}\n\n`);
    }
    res.end();
  }
}
