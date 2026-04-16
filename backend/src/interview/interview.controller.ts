import { Controller, Post, Get, Param, Body, Query, Req, Res, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { FileInterceptor } from '@nestjs/platform-express';
import { InterviewService } from './interview.service';
import { OptionalAuthGuard } from '../auth/jwt.guard';
import { Request, Response } from 'express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';

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

class AnswerAudioUploadDto {
  @IsString() session_id: string;
  @IsString() round_id: string;
  @IsOptional() @IsString() transcript?: string;
  @IsOptional() @Type(() => Number) @IsNumber() duration_ms?: number;
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

  @Post('interview/answer-audio')
  @UseInterceptors(FileInterceptor('audio', { storage: audioStorage }))
  async uploadAnswerAudio(
    @UploadedFile() file: any,
    @Body() dto: AnswerAudioUploadDto,
    @Req() req: Request,
  ): Promise<any> {
    if (!file) throw new BadRequestException('Audio file is required');
    return this.interviewService.attachAnswerAudio(dto.session_id, dto.round_id, {
      fileName: file.filename,
      mimeType: file.mimetype || 'audio/webm',
      size: file.size || 0,
      transcript: dto.transcript || '',
      durationMs: dto.duration_ms ?? null,
      host: req.get('host') || '',
      protocol: req.protocol || 'http',
    });
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

    try {
      res.write(`data: ${JSON.stringify({ type: 'status', text: 'Analyzing your answer...' })}\n\n`);

      const result = await this.interviewService.evaluateAnswer(dto.session_id, dto.round_id, dto.answer);
      const feedback = result.feedback || '';

      // Stream feedback in speech-friendly chunks (avoid 1-4 char tokens).
      // We try to cut near punctuation/whitespace so the frontend TTS can speak naturally.
      let idx = 0;
      const minChunkSize = 20;
      const maxChunkSize = 90;
      while (idx < feedback.length) {
        const tentativeEnd = Math.min(feedback.length, idx + maxChunkSize);
        let end = tentativeEnd;

        // Prefer to end on a word boundary or punctuation within the last ~30 chars.
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
          // Small pacing so the stream feels "live" without slowing too much.
          await new Promise(r => setTimeout(r, 20));
        }
        idx = end;
      }

      res.write(`data: ${JSON.stringify({ type: 'complete', data: result })}\n\n`);
      res.write(`data: [DONE]\n\n`);
    } catch (error) {
      res.write(`data: ${JSON.stringify({ type: 'error', text: error.message || 'Evaluation failed' })}\n\n`);
    }
    res.end();
  }
}
