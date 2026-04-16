import { Injectable, HttpException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { AiService } from '../ai/ai.service';
import { QuestionsService } from '../questions/questions.service';
import { Session } from '../schemas/session.schema';
import { Round } from '../schemas/round.schema';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class InterviewService {
  constructor(
    @InjectModel(Session.name) private sessionModel: Model<Session>,
    @InjectModel(Round.name) private roundModel: Model<Round>,
    private aiService: AiService,
    private questionsService: QuestionsService,
    @Inject(forwardRef(() => NotificationsService)) private notifService: NotificationsService,
  ) {}

  async createSession(data: any, userId?: string): Promise<any> {
    const session = {
      id: uuidv4(),
      user_id: userId || null,
      tech_stack: data.tech_stack,
      category: data.category,
      difficulty: data.difficulty,
      num_questions: data.num_questions ?? 8,
      timed_mode: data.timed_mode ?? false,
      time_per_question: data.time_per_question ?? 300,
      questions_asked: 0,
      status: 'active',
      avg_score: null,
      created_at: new Date().toISOString(),
      completed_at: null,
    };
    await this.sessionModel.create(session);
    return session;
  }

  async listSessions(status?: string, limit = 50): Promise<any[]> {
    const query: any = {};
    if (status) query.status = status;
    return this.sessionModel.find(query, { _id: 0, __v: 0 }).sort({ created_at: -1 }).limit(limit).lean();
  }

  async getSession(sessionId: string): Promise<any> {
    const session = await this.sessionModel.findOne({ id: sessionId }, { _id: 0, __v: 0 }).lean();
    if (!session) throw new HttpException('Session not found', 404);
    const rounds = await this.roundModel.find({ session_id: sessionId }, { _id: 0, __v: 0 }).sort({ order: 1 }).lean();
    return { session, rounds };
  }

  async generateQuestion(sessionId: string): Promise<any> {
    const session = await this.sessionModel.findOne({ id: sessionId }).lean();
    if (!session) throw new HttpException('Session not found', 404);
    if (session.status !== 'active') throw new HttpException('Session is not active', 400);

    const pastRounds = await this.roundModel.find({ session_id: sessionId }, { question: 1, order: 1, question_id: 1 }).sort({ order: 1 }).lean();
    const pastQuestionTexts = pastRounds.map((r) => r.question);
    const usedQuestionIds = pastRounds.map((r: any) => r.question_id).filter(Boolean);

    try {
      const questions = await this.questionsService.getRandomQuestions({
        stack: session.tech_stack,
        difficulty: session.difficulty,
        count: 20,
        excludeIds: usedQuestionIds,
      });

      const availableQuestions = questions.filter(q => !pastQuestionTexts.includes(q.question));
      
      if (availableQuestions.length === 0) {
        throw new HttpException('No more questions available for this session', 400);
      }

      const selectedQuestion = availableQuestions[0];
      
      // Calculate the next order number more reliably
      const maxOrder = pastRounds.length > 0 ? Math.max(...pastRounds.map(r => r.order || 0)) : 0;
      const order = maxOrder + 1;
      
      const round = {
        id: uuidv4(),
        session_id: sessionId,
        order,
        question_id: selectedQuestion.id,
        question: selectedQuestion.question,
        question_type: selectedQuestion.question_type || 'conceptual',
        topic: selectedQuestion.topic || 'general',
        expected_key_points: selectedQuestion.expected_key_points || [],
        hint: selectedQuestion.hint || '',
        answer: null, score: null, feedback: null,
        strengths: [], weaknesses: [],
        follow_up_question: null, improvement_suggestions: [], verdict: null,
        created_at: new Date().toISOString(),
      };

      await this.roundModel.create(round);
      await this.sessionModel.updateOne({ id: sessionId }, { $set: { questions_asked: order } });
      return round;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(`Question retrieval failed: ${error.message}`, 500);
    }
  }

  async createRound(sessionId: string, questionId: string): Promise<any> {
    const session = await this.sessionModel.findOne({ id: sessionId }).lean();
    if (!session) throw new HttpException('Session not found', 404);
    if (session.status !== 'active') throw new HttpException('Session is not active', 400);

    const question = await this.questionsService.getQuestionById(questionId);
    if (!question) throw new HttpException('Question not found', 404);

    const pastRounds = await this.roundModel.find({ session_id: sessionId }, { order: 1 }).sort({ order: 1 }).lean();
    const maxOrder = pastRounds.length > 0 ? Math.max(...pastRounds.map(r => r.order || 0)) : 0;
    const order = maxOrder + 1;

    const round = {
      id: uuidv4(),
      session_id: sessionId,
      order,
      question_id: question.id,
      question: question.question,
      question_type: question.question_type || 'conceptual',
      topic: question.topic || 'general',
      expected_key_points: question.expected_key_points || [],
      hint: question.hint || '',
      answer: null, score: null, feedback: null,
      strengths: [], weaknesses: [],
      follow_up_question: null, improvement_suggestions: [], verdict: null,
      created_at: new Date().toISOString(),
    };

    await this.roundModel.create(round);
    await this.sessionModel.updateOne({ id: sessionId }, { $set: { questions_asked: order } });
    return round;
  }

  async evaluateAnswer(sessionId: string, roundId: string, answer: string): Promise<any> {
    const session = await this.sessionModel.findOne({ id: sessionId }).lean();
    if (!session) throw new HttpException('Session not found', 404);
    const round = await this.roundModel.findOne({ id: roundId }).lean();
    if (!round) throw new HttpException('Round not found', 404);

    const prompt = this.buildEvalPrompt(session.tech_stack, session.category, session.difficulty, round.question, answer);

    try {
      const response = await this.aiService.generate(prompt, 'Evaluate this answer thoroughly now.');
      const evalData = this.aiService.parseJson(response);

      let scoreVal = evalData.score ?? 0;
      if (typeof scoreVal === 'string') scoreVal = parseFloat(scoreVal) || 0;

      const update = {
        answer,
        score: scoreVal,
        feedback: evalData.feedback || '',
        strengths: evalData.strengths || [],
        weaknesses: evalData.weaknesses || [],
        follow_up_question: evalData.follow_up_question || '',
        improvement_suggestions: evalData.improvement_suggestions || [],
        verdict: evalData.verdict || 'needs_improvement',
      };

      await this.roundModel.updateOne({ id: roundId }, { $set: update });

      const scoredRounds = await this.roundModel.find(
        { session_id: sessionId, score: { $ne: null } }, { score: 1 },
      ).lean();
      if (scoredRounds.length) {
        const avg = scoredRounds.reduce((a, r) => a + r.score, 0) / scoredRounds.length;
        await this.sessionModel.updateOne({ id: sessionId }, { $set: { avg_score: Math.round(avg * 10) / 10 } });
      }

      return { ...round, ...update, _id: undefined, __v: undefined };
    } catch (error) {
      throw new HttpException(`AI evaluation failed: ${error.message}`, 500);
    }
  }

  async attachAnswerAudio(
    sessionId: string,
    roundId: string,
    data: {
      fileName: string;
      mimeType: string;
      size: number;
      transcript?: string;
      durationMs?: number | null;
      host: string;
      protocol: string;
    },
  ): Promise<any> {
    const session = await this.sessionModel.findOne({ id: sessionId }).lean();
    if (!session) throw new HttpException('Session not found', 404);
    const round = await this.roundModel.findOne({ id: roundId, session_id: sessionId }).lean();
    if (!round) throw new HttpException('Round not found', 404);

    const baseUrl = `${data.protocol}://${data.host}`;
    const audioUrl = `${baseUrl}/uploads/answers/${data.fileName}`;
    const update: any = {
      answer_audio_url: audioUrl,
      answer_audio_mime_type: data.mimeType || 'audio/webm',
      answer_audio_duration_ms: data.durationMs ?? null,
    };
    if (data.transcript && data.transcript.trim()) {
      update.answer = data.transcript.trim();
    }

    await this.roundModel.updateOne({ id: roundId }, { $set: update });
    return { ...round, ...update, _id: undefined, __v: undefined };
  }

  async completeSession(sessionId: string, userId?: string): Promise<any> {
    const session = await this.sessionModel.findOne({ id: sessionId }).lean();
    if (!session) throw new HttpException('Session not found', 404);

    const rounds = await this.roundModel.find(
      { session_id: sessionId, score: { $ne: null } }, { _id: 0, __v: 0 },
    ).lean();
    const avg = rounds.length ? rounds.reduce((a, r) => a + r.score, 0) / rounds.length : 0;
    const now = new Date().toISOString();

    await this.sessionModel.updateOne({ id: sessionId }, {
      $set: { status: 'completed', avg_score: Math.round(avg * 10) / 10, completed_at: now },
    });

    const updated = { ...session, status: 'completed', avg_score: Math.round(avg * 10) / 10, completed_at: now };
    delete (updated as any)._id;
    delete (updated as any).__v;

    const effectiveUserId = userId || (session as any).user_id;
    if (effectiveUserId && this.notifService) {
      this.notifService.onSessionComplete(effectiveUserId, updated).catch(() => {});
    }

    return { session: updated, rounds };
  }

  private buildQuestionPrompt(techStack: string, category: string, difficulty: string, pastQuestions: string[]): string {
    const diffMap = {
      beginner: 'You are conducting a beginner-friendly interview. Ask fundamental questions that test core understanding. Be clear and encouraging.',
      intermediate: 'You are conducting a mid-level interview. Ask practical, scenario-based questions that test real-world application. Be thorough.',
      advanced: 'You are conducting a senior-level interview. Ask deep, tricky questions that test architectural thinking and edge cases. Be strict and challenging.',
    };
    const past = pastQuestions.length ? pastQuestions.map((q) => `- ${q}`).join('\n') : 'None yet';
    return `You are a strict technical interviewer specializing in ${techStack} (${category}).
${diffMap[difficulty] || diffMap.intermediate}

Previously asked questions in this session (DO NOT repeat or ask similar questions):
${past}

Generate ONE unique interview question. Respond in ONLY valid JSON (no markdown, no extra text):
{"question":"the full question text","type":"coding|conceptual|scenario","topic":"specific topic area","expected_key_points":["point1","point2","point3"],"hint":"a subtle hint if candidate is stuck"}`;
  }

  private buildEvalPrompt(techStack: string, category: string, difficulty: string, question: string, answer: string): string {
    const grillMap = {
      beginner: 'Be supportive and educational. Provide detailed guidance on what was right and wrong. Still identify areas for improvement clearly.',
      intermediate: 'Be moderately strict. Point out weaknesses firmly. Provide one challenging follow-up question that digs deeper.',
      advanced: 'Be VERY strict and aggressive. Challenge every weak point in the answer. Grill the candidate hard with a deep, tricky follow-up question that exposes gaps.',
    };
    return `You are a strict technical interviewer evaluating a ${difficulty}-level candidate's answer for ${techStack} (${category}).
${grillMap[difficulty] || grillMap.intermediate}

Question asked: ${question}

Candidate's answer: ${answer}

Evaluate thoroughly and respond in ONLY valid JSON (no markdown, no extra text):
{"score":<number 0 to 10>,"feedback":"detailed evaluation feedback","strengths":["strength1","strength2"],"weaknesses":["weakness1","weakness2"],"follow_up_question":"a grilling follow-up question","improvement_suggestions":["suggestion1","suggestion2"],"verdict":"strong|acceptable|needs_improvement|poor"}`;
  }
}
