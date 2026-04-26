import { Controller, Post, Get, Param, Body, Query, Req, Res, UseGuards, UseInterceptors, UploadedFile, BadRequestException, Headers } from '@nestjs/common';
import { IsString, IsOptional, IsNumber, IsBoolean, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { FileInterceptor } from '@nestjs/platform-express';
import { InterviewService } from './interview.service';
import { OptionalAuthGuard } from '../auth/jwt.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request, Response } from 'express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { hashRequestIp } from '../common/request-ip.util';

class CreateSessionDto {
  @IsString() tech_stack: string;
  @IsString() category: string;
  @IsString() difficulty: string;
  @IsOptional() @IsNumber() @Type(() => Number) num_questions?: number;
  @IsOptional() @IsBoolean() timed_mode?: boolean;
  @IsOptional() @IsNumber() @Type(() => Number) time_per_question?: number;
  @IsOptional() @IsString() @MaxLength(128) client_fingerprint?: string;
}

class QuestionRequestDto {
  @IsString() session_id: string;
}

class CreateRoundDto {
  @IsString() session_id: string;
  @IsString() question_id: string;
}

class AnswerSubmitDto {
  @IsString() session_id: string;
  @IsString() round_id: string;
  @IsString() answer: string;
}

class AnswerAudioUploadDto {
  @IsString() session_id: string;
  @IsString() round_id: string;
  @IsOptional() @IsString() transcript?: string;
  @IsOptional() @Type(() => Number) @IsNumber() duration_ms?: number;
}

class DeleteAudioDto {
  @IsString() session_id: string;
  @IsString() round_id: string;
}

class RunCodeDto {
  @IsString() stack: string;
  @IsString() code: string;
  @IsOptional() @IsString() stdin?: string;
}

const uploadsDir = join(process.cwd(), 'uploads', 'answers');
const ensureUploadsDir = () => {
  if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });
};

const audioStorage = diskStorage({
  destination: (_req, _file, cb) => {
    ensureUploadsDir();
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const body = req.body as { session_id?: string; round_id?: string };
    const sessionId = (body?.session_id || 'session').replace(/[^a-zA-Z0-9-_]/g, '');
    const roundId = (body?.round_id || 'round').replace(/[^a-zA-Z0-9-_]/g, '');
    const ext = extname(file.originalname || '') || '.webm';
    cb(null, `${sessionId}-${roundId}-${Date.now()}${ext}`);
  },
});

@Controller()
export class InterviewController {
  constructor(private readonly interviewService: InterviewService) {}

  @Post('sessions')
  @UseGuards(OptionalAuthGuard)
  createSession(@Body() dto: CreateSessionDto, @Req() req: Request): Promise<any> {
    return this.interviewService.createSession(dto, (req as any).user?._id, hashRequestIp(req));
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  listSessions(
    @Req() req: Request,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ): Promise<any> {
    return this.interviewService.listSessions((req as any).user._id, status, limit ? parseInt(limit, 10) : 50);
  }

  @Get('sessions/:sessionId')
  @UseGuards(OptionalAuthGuard)
  getSession(
    @Param('sessionId') sessionId: string,
    @Req() req: Request,
    @Headers('x-session-secret') secret?: string,
  ): Promise<any> {
    return this.interviewService.getSession(sessionId, (req as any).user, secret);
  }

  @Post('interview/question')
  @UseGuards(OptionalAuthGuard)
  generateQuestion(@Body() dto: QuestionRequestDto, @Req() req: Request, @Headers('x-session-secret') secret?: string): Promise<any> {
    return this.interviewService.generateQuestion(dto.session_id, (req as any).user, secret);
  }

  @Post('interview/round')
  @UseGuards(OptionalAuthGuard)
  createRound(
    @Body() dto: CreateRoundDto,
    @Req() req: Request,
    @Headers('x-session-secret') secret?: string,
  ): Promise<any> {
    return this.interviewService.createRound(dto.session_id, dto.question_id, (req as any).user, secret);
  }

  @Post('interview/evaluate')
  @UseGuards(OptionalAuthGuard)
  evaluateAnswer(
    @Body() dto: AnswerSubmitDto,
    @Req() req: Request,
    @Headers('x-session-secret') secret?: string,
  ): Promise<any> {
    return this.interviewService.evaluateAnswer(dto.session_id, dto.round_id, dto.answer, (req as any).user, secret);
  }

  @Post('interview/submit')
  @UseGuards(OptionalAuthGuard)
  submitAnswer(
    @Body() dto: AnswerSubmitDto,
    @Req() req: Request,
    @Headers('x-session-secret') secret?: string,
  ): Promise<any> {
    return this.interviewService.submitAnswer(dto.session_id, dto.round_id, dto.answer, (req as any).user, secret);
  }

  @Post('interview/answer')
  @UseGuards(OptionalAuthGuard)
  updateSubmittedAnswer(
    @Body() dto: AnswerSubmitDto,
    @Req() req: Request,
    @Headers('x-session-secret') secret?: string,
  ): Promise<any> {
    return this.interviewService.updateSubmittedAnswer(dto.session_id, dto.round_id, dto.answer, (req as any).user, secret);
  }

  @Post('interview/answer-audio/delete')
  @UseGuards(OptionalAuthGuard)
  deleteAnswerAudio(
    @Body() dto: DeleteAudioDto,
    @Req() req: Request,
    @Headers('x-session-secret') secret?: string,
  ): Promise<any> {
    return this.interviewService.deleteAnswerAudio(dto.session_id, dto.round_id, (req as any).user, secret);
  }

  @Post('interview/answer-audio')
  @UseGuards(OptionalAuthGuard)
  @UseInterceptors(FileInterceptor('audio', { storage: audioStorage, limits: { fileSize: 25 * 1024 * 1024 } }))
  async uploadAnswerAudio(
    @UploadedFile() file: any,
    @Body() dto: AnswerAudioUploadDto,
    @Req() req: Request,
  ): Promise<any> {
    if (!file) throw new BadRequestException('Audio file is required');
    return this.interviewService.attachAnswerAudio(
      dto.session_id,
      dto.round_id,
      {
        fileName: file.filename,
        mimeType: file.mimetype || 'audio/webm',
        size: file.size || 0,
        transcript: dto.transcript || '',
        durationMs: dto.duration_ms ?? null,
        host: req.get('host') || '',
        protocol: req.protocol || 'http',
      },
      (req as any).user,
      (req.headers['x-session-secret'] as string) || undefined,
    );
  }

  @Post('sessions/:sessionId/complete')
  @UseGuards(OptionalAuthGuard)
  async completeSession(
    @Param('sessionId') sessionId: string,
    @Req() req: Request,
    @Headers('x-session-secret') secret?: string,
  ): Promise<any> {
    return this.interviewService.completeSession(sessionId, (req as any).user, secret, (req as any).user?._id);
  }

  @Post('interview/evaluate-stream')
  @UseGuards(OptionalAuthGuard)
  async evaluateStream(
    @Body() dto: AnswerSubmitDto,
    @Req() req: Request,
    @Res() res: Response,
    @Headers('x-session-secret') secret?: string,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      res.write(`data: ${JSON.stringify({ type: 'status', text: 'Analyzing your answer...' })}\n\n`);

      const result = await this.interviewService.evaluateAnswer(
        dto.session_id,
        dto.round_id,
        dto.answer,
        (req as any).user,
        secret,
      );
      const feedback = result.feedback || '';

      let idx = 0;
      const minChunkSize = 20;
      const maxChunkSize = 90;
      while (idx < feedback.length) {
        const tentativeEnd = Math.min(feedback.length, idx + maxChunkSize);
        let end = tentativeEnd;

        const searchStart = Math.max(idx + minChunkSize, tentativeEnd - 30);
        const segment = feedback.slice(searchStart, tentativeEnd);
        const boundaryMatch = segment.match(/[\s.!?;,:\n]/g);
        if (boundaryMatch && boundaryMatch.length > 0) {
          const lastBoundaryChar = boundaryMatch[boundaryMatch.length - 1];
          const lastBoundaryIndexInSegment = segment.lastIndexOf(lastBoundaryChar);
          const candidateEnd = searchStart + lastBoundaryIndexInSegment + 1;
          if (candidateEnd > idx + minChunkSize) end = candidateEnd;
        }

        const chunk = feedback.slice(idx, end);
        if (chunk) {
          res.write(`data: ${JSON.stringify({ type: 'text', text: chunk })}\n\n`);
          await new Promise((r) => setTimeout(r, 20));
        }
        idx = end;
      }

      res.write(`data: ${JSON.stringify({ type: 'complete', data: result })}\n\n`);
      res.write(`data: [DONE]\n\n`);
    } catch (error: any) {
      res.write(`data: ${JSON.stringify({ type: 'error', text: error.message || 'Evaluation failed' })}\n\n`);
    }
    res.end();
  }

  @Post('interview/code/run')
  @UseGuards(OptionalAuthGuard)
  runCode(@Body() dto: RunCodeDto): Promise<any> {
    return this.interviewService.runCode(dto.stack, dto.code, dto.stdin || '');
  }
}
