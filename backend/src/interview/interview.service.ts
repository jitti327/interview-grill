import { Injectable, HttpException, Inject, forwardRef } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { existsSync, unlinkSync } from 'fs';
import { basename, join } from 'path';
import { AiService } from '../ai/ai.service';
import { QuestionsService } from '../questions/questions.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

const ANON_MAX_QUESTIONS = 3;
const FREE_TIER_MAX_QUESTIONS = 5;
const SUBSCRIBER_MAX_QUESTIONS = 30;
const QUESTION_REPEAT_COOLDOWN_SESSIONS = 6;

export type SessionUser = { _id: string; email?: string; name?: string; role?: string } | null | undefined;
type EvalMode = 'ai_first' | 'db_only' | 'ai_only';

type CodingTestCase = { label: string; input: string; expected_output: string };

function serializeRound(r: {
  id: string;
  session_id: string;
  round_order: number;
  question_id: string | null;
  question: string;
  question_type: string;
  topic: string;
  expected_key_points: string[];
  hint: string;
  coding_template: string | null;
  coding_test_cases: any | null;
  answer: string | null;
  answer_audio_url: string | null;
  answer_audio_mime_type: string | null;
  answer_audio_duration_ms: number | null;
  score: number | null;
  feedback: string | null;
  strengths: string[];
  weaknesses: string[];
  follow_up_question: string | null;
  improvement_suggestions: string[];
  verdict: string | null;
  created_at: Date;
}) {
  const { round_order, ...rest } = r;
  return { ...rest, order: round_order };
}

function serializeSession<T extends { session_secret?: string | null }>(s: T) {
  const { session_secret: _s, ...rest } = s as any;
  return rest;
}

@Injectable()
export class InterviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly questionsService: QuestionsService,
    @Inject(forwardRef(() => NotificationsService)) private notifService: NotificationsService,
  ) {}

  private evaluationMode(): EvalMode {
    const raw = String(process.env.EVAL_MODE || 'ai_first')
      .trim()
      .toLowerCase();
    if (raw === 'db_only' || raw === 'ai_only') return raw;
    return 'ai_first';
  }

  private trimFingerprint(value: unknown): string | null {
    if (typeof value !== 'string' || !value.length) {
      return null;
    }
    return value.length > 128 ? value.slice(0, 128) : value;
  }

  private isFullPlanUser(u: { role: string; is_subscriber: boolean } | null) {
    if (!u) return false;
    return u.role === 'admin' || u.is_subscriber;
  }

  private isAdminUser(u: { role: string } | null) {
    return Boolean(u && u.role === 'admin');
  }

  private async getAnonIpRemaining(ipHash: string): Promise<number> {
    const row = await this.prisma.anonIpUsage.findUnique({ where: { ip_hash: ipHash } });
    const used = row?.questions_used ?? 0;
    return Math.max(0, ANON_MAX_QUESTIONS - used);
  }

  private async reserveAnonInTx(tx: Prisma.TransactionClient, ipHash: string) {
    const bump = await tx.anonIpUsage.updateMany({
      where: { ip_hash: ipHash, questions_used: { lt: ANON_MAX_QUESTIONS } },
      data: { questions_used: { increment: 1 } },
    });
    if (bump.count > 0) {
      return;
    }
    try {
      await tx.anonIpUsage.create({ data: { ip_hash: ipHash, questions_used: 1 } });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        const b2 = await tx.anonIpUsage.updateMany({
          where: { ip_hash: ipHash, questions_used: { lt: ANON_MAX_QUESTIONS } },
          data: { questions_used: { increment: 1 } },
        });
        if (b2.count === 0) {
          throw new HttpException(
            'Guest question limit reached for this network. Create an account to continue.',
            403,
          );
        }
        return;
      }
      throw err;
    }
  }

  private async getSessionUsageHints(session: {
    id: string;
    user_id: string | null;
    ip_hash: string | null;
    client_fingerprint: string | null;
    num_questions: number;
  }) {
    const hints: string[] = [];
    if (!session.user_id) {
      const used = session.ip_hash
        ? (await this.prisma.anonIpUsage.findUnique({ where: { ip_hash: session.ip_hash } }))?.questions_used ?? 0
        : 0;
      if (session.ip_hash) {
        const otherActive = await this.prisma.session.count({
          where: { ip_hash: session.ip_hash, status: 'active', id: { not: session.id } },
        });
        if (otherActive > 0) {
          hints.push('other_active_guest_session_same_network');
        }
        if (session.client_fingerprint) {
          const otherFp = await this.prisma.session.findFirst({
            where: {
              ip_hash: session.ip_hash,
              status: 'active',
              id: { not: session.id },
              client_fingerprint: { not: null },
            },
            select: { client_fingerprint: true },
          });
          if (
            otherFp?.client_fingerprint &&
            otherFp.client_fingerprint.length > 0 &&
            otherFp.client_fingerprint !== session.client_fingerprint
          ) {
            hints.push('possible_different_client_same_network');
          }
        }
      }
      return {
        guest: {
          per_network_question_cap: ANON_MAX_QUESTIONS,
          per_network_questions_used: used,
          per_network_questions_remaining: Math.max(0, ANON_MAX_QUESTIONS - used),
        },
        hints,
      };
    }

    const u = await this.prisma.user.findUnique({
      where: { id: session.user_id },
      select: { is_subscriber: true, role: true },
    });
    const hasSubscription = u ? this.isFullPlanUser(u) : false;
    const isAdmin = this.isAdminUser(u);
    const otherActive = await this.prisma.session.count({
      where: { user_id: session.user_id, status: 'active', id: { not: session.id } },
    });
    if (otherActive > 0) {
      hints.push('other_active_session_same_account');
    }
    return {
      account: {
        has_subscription: hasSubscription,
        per_session_cap: isAdmin
          ? null
          : hasSubscription
            ? SUBSCRIBER_MAX_QUESTIONS
            : FREE_TIER_MAX_QUESTIONS,
      },
      hints,
    };
  }

  assertSessionAccess(
    session: { user_id: string | null; session_secret: string | null },
    user?: SessionUser,
    sessionSecretHeader?: string | null,
  ) {
    if (session.user_id) {
      if (!user || user._id !== session.user_id) {
        throw new HttpException('Forbidden', 403);
      }
      return;
    }
    if (!session.session_secret) {
      throw new HttpException('Forbidden', 403);
    }
    if (!sessionSecretHeader || sessionSecretHeader !== session.session_secret) {
      throw new HttpException('Forbidden', 403);
    }
  }

  private normalizeStack(value?: string): string {
    const raw = (value || '').trim().toLowerCase().replace(/\s+/g, '').replace(/\./g, '');
    const aliases: Record<string, string> = {
      node: 'nodejs',
      nodejs: 'nodejs',
      reactjs: 'react',
      vuejs: 'vue',
      angularjs: 'angular',
      emberjs: 'ember',
      next: 'nextjs',
      nextjs: 'nextjs',
      expressjs: 'express',
      python: 'python',
      java: 'java',
      dotnet: 'dotnet',
      'c#': 'dotnet',
      csharp: 'dotnet',
      javascript: 'nodejs',
      typescript: 'nodejs',
    };
    return aliases[raw] || raw;
  }

  private codingLanguageForStack(stack: string): 'javascript' | 'typescript' | 'python' | 'java' | 'csharp' {
    if (stack === 'python') return 'python';
    if (stack === 'java') return 'java';
    if (stack === 'dotnet') return 'csharp';
    if (stack === 'angular') return 'typescript';
    return 'javascript';
  }

  private codingTemplateForStack(stack: string, question: string, topic: string): string {
    const banner = `${topic ? `// Topic: ${topic}\n` : ''}// Question: ${question}\n`;
    const normalized = this.normalizeStack(stack);
    if (normalized === 'python') {
      return `${banner}def solve(input_text: str) -> str:
    # TODO: implement for this question
    return input_text.strip()

if __name__ == "__main__":
    import sys
    data = sys.stdin.read()
    print(solve(data))`;
    }
    if (normalized === 'java') {
      return `${banner}import java.io.*;

public class Main {
    static String solve(String input) {
        // TODO: implement for this question
        return input.trim();
    }

    public static void main(String[] args) throws Exception {
        String input = new String(System.in.readAllBytes());
        System.out.print(solve(input));
    }
}`;
    }
    if (normalized === 'dotnet') {
      return `${banner}using System;

public class Program {
    static string Solve(string input) {
        // TODO: implement for this question
        return input.Trim();
    }

    public static void Main() {
        var input = Console.In.ReadToEnd();
        Console.Write(Solve(input));
    }
}`;
    }
    if (normalized === 'angular') {
      return `${banner}function solve(input: string): string {
  // TODO: implement for this question
  return input.trim();
}

import * as fs from "fs";
const input = fs.readFileSync(0, "utf8");
console.log(solve(input));`;
    }
    return `${banner}function solve(input) {
  // TODO: implement for this question
  return input.trim();
}

const fs = require("fs");
const input = fs.readFileSync(0, "utf8");
process.stdout.write(String(solve(input)));`;
  }

  private codingTestCasesForRound(
    stack: string,
    topic: string,
    expectedKeyPoints: string[] = [],
  ): CodingTestCase[] {
    const normalizedTopic = (topic || '').toLowerCase();
    if (normalizedTopic.includes('array') || normalizedTopic.includes('list')) {
      return [
        { label: 'Case 1', input: '1 2 3 4 5\n', expected_output: '1 2 3 4 5' },
        { label: 'Case 2', input: '10 20 30\n', expected_output: '10 20 30' },
      ];
    }
    if (normalizedTopic.includes('string')) {
      return [
        { label: 'Case 1', input: 'hello\n', expected_output: 'hello' },
        { label: 'Case 2', input: 'Interview Grill\n', expected_output: 'Interview Grill' },
      ];
    }
    if (normalizedTopic.includes('sort')) {
      return [
        { label: 'Case 1', input: '3 1 2\n', expected_output: '1 2 3' },
        { label: 'Case 2', input: '10 5 7 1\n', expected_output: '1 5 7 10' },
      ];
    }
    const kpHint = expectedKeyPoints[0] || 'Handle input parsing and expected output carefully';
    return [
      { label: 'Case 1', input: 'sample input\n', expected_output: 'sample input' },
      { label: 'Case 2', input: 'another sample\n', expected_output: 'another sample' },
      { label: 'Hint', input: '', expected_output: kpHint },
    ];
  }

  private enrichRoundForClient(round: any, techStack?: string) {
    const base = serializeRound(round);
    if ((round.question_type || '').toLowerCase() !== 'coding') {
      return base;
    }
    const stack = this.normalizeStack(techStack || 'nodejs');
  const dbTemplate =
    typeof round.coding_template === 'string' && round.coding_template.trim()
      ? round.coding_template
      : null;
  const dbTestCases = Array.isArray(round.coding_test_cases) ? round.coding_test_cases : null;
    return {
      ...base,
      coding_language: this.codingLanguageForStack(stack),
    coding_template: dbTemplate || this.codingTemplateForStack(stack, round.question || '', round.topic || ''),
    coding_test_cases:
      dbTestCases || this.codingTestCasesForRound(stack, round.topic || '', round.expected_key_points || []),
    };
  }

  private async getCooldownQuestionIdsForSession(session: {
    id: string;
    user_id: string | null;
    ip_hash: string | null;
    tech_stack: string;
  }): Promise<string[]> {
    const recentWhere: Prisma.SessionWhereInput = {
      id: { not: session.id },
      status: 'completed',
      tech_stack: session.tech_stack,
    };
    if (session.user_id) {
      recentWhere.user_id = session.user_id;
    } else if (session.ip_hash) {
      recentWhere.ip_hash = session.ip_hash;
    } else {
      return [];
    }

    const recentSessions = await this.prisma.session.findMany({
      where: recentWhere,
      orderBy: { completed_at: 'desc' },
      take: QUESTION_REPEAT_COOLDOWN_SESSIONS,
      select: { id: true },
    });
    const sessionIds = recentSessions.map((s) => s.id);
    if (!sessionIds.length) return [];

    const rounds = await this.prisma.round.findMany({
      where: { session_id: { in: sessionIds }, question_id: { not: null } },
      select: { question_id: true },
    });
    return Array.from(new Set(rounds.map((r) => r.question_id).filter(Boolean) as string[]));
  }

  async createSession(data: any, userId?: string, requestIpHash?: string | null): Promise<any> {
    const fp = this.trimFingerprint(data?.client_fingerprint);
    let numQuestions = Number(data.num_questions);
    if (!Number.isFinite(numQuestions) || numQuestions < 1) {
      numQuestions = 8;
    }
    numQuestions = Math.floor(numQuestions);

    if (!userId) {
      if (!requestIpHash) {
        throw new HttpException('Unable to determine client network for guest session', 400);
      }
      const remaining = await this.getAnonIpRemaining(requestIpHash);
      if (remaining < 1) {
        throw new HttpException(
          'Guest question limit reached for this network. Create an account to continue.',
          403,
        );
      }
      numQuestions = Math.min(numQuestions, ANON_MAX_QUESTIONS, remaining);
    } else {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new HttpException('User not found', 404);
      }
      if (user.role !== 'admin') {
        const cap = this.isFullPlanUser(user) ? SUBSCRIBER_MAX_QUESTIONS : FREE_TIER_MAX_QUESTIONS;
        numQuestions = Math.min(numQuestions, cap);
      }
    }

    const session_secret = userId ? null : crypto.randomBytes(32).toString('hex');
    const session = await this.prisma.session.create({
      data: {
        tech_stack: data.tech_stack,
        category: data.category,
        difficulty: data.difficulty,
        num_questions: numQuestions,
        timed_mode: data.timed_mode ?? false,
        time_per_question: data.time_per_question ?? 300,
        questions_asked: 0,
        status: 'active',
        avg_score: null,
        user_id: userId || null,
        session_secret,
        ip_hash: requestIpHash || null,
        client_fingerprint: fp,
      },
    });
    const s = serializeSession(session);
    return session_secret ? { ...s, session_secret } : s;
  }

  async listSessions(userId: string, status?: string, limit = 50): Promise<any[]> {
    const where: Prisma.SessionWhereInput = { user_id: userId };
    if (status) where.status = status;
    const sessions = await this.prisma.session.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
    });
    return sessions.map((x) => serializeSession(x));
  }

  async getSession(sessionId: string, user?: SessionUser, sessionSecret?: string | null): Promise<any> {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) throw new HttpException('Session not found', 404);
    this.assertSessionAccess(session, user, sessionSecret);
    const rounds = await this.prisma.round.findMany({
      where: { session_id: sessionId },
      orderBy: { round_order: 'asc' },
    });
    const usage = await this.getSessionUsageHints(session);
    return {
      session: serializeSession(session),
      rounds: rounds.map((r) => this.enrichRoundForClient(r, session.tech_stack)),
      usage,
    };
  }

  async generateQuestion(sessionId: string, user?: SessionUser, sessionSecret?: string | null): Promise<any> {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) throw new HttpException('Session not found', 404);
    this.assertSessionAccess(session, user, sessionSecret);
    if (session.status !== 'active') throw new HttpException('Session is not active', 400);

    const pastRounds = await this.prisma.round.findMany({
      where: { session_id: sessionId },
      select: { question: true, round_order: true, question_id: true },
      orderBy: { round_order: 'asc' },
    });
    if (pastRounds.length >= session.num_questions) {
      throw new HttpException('This session has already reached the configured number of questions', 400);
    }
    const pastQuestionTexts = pastRounds.map((r) => r.question);
    const usedQuestionIds = pastRounds.map((r) => r.question_id).filter(Boolean) as string[];
    const cooldownQuestionIds = await this.getCooldownQuestionIdsForSession(session);
    const avoidQuestionIds = Array.from(new Set([...usedQuestionIds, ...cooldownQuestionIds]));

    try {
      let questions = await this.questionsService.getRandomQuestions({
        stack: session.tech_stack,
        difficulty: session.difficulty,
        count: 20,
        excludeIds: avoidQuestionIds,
      });
      if (!questions.length && cooldownQuestionIds.length) {
        questions = await this.questionsService.getRandomQuestions({
          stack: session.tech_stack,
          difficulty: session.difficulty,
          count: 20,
          excludeIds: usedQuestionIds,
        });
      }

      const availableQuestions = questions.filter((q) => !pastQuestionTexts.includes(q.question));

      if (availableQuestions.length === 0) {
        throw new HttpException('No more questions available for this session', 400);
      }

      const selectedQuestion = availableQuestions[0];
      const maxOrder = pastRounds.length > 0 ? Math.max(...pastRounds.map((r) => r.round_order || 0)) : 0;
      const order = maxOrder + 1;

      const round = await this.prisma.$transaction(
        async (tx) => {
          if (!session.user_id && session.ip_hash) {
            await this.reserveAnonInTx(tx, session.ip_hash);
          } else if (!session.user_id && !session.ip_hash) {
            // Legacy guest sessions: skip network quota
          }
          return tx.round.create({
            data: {
              id: uuidv4(),
              session_id: sessionId,
              round_order: order,
              question_id: selectedQuestion.id,
              question: selectedQuestion.question,
              question_type: selectedQuestion.question_type || 'conceptual',
              topic: selectedQuestion.topic || 'general',
              expected_key_points: selectedQuestion.expected_key_points || [],
              hint: selectedQuestion.hint || '',
              coding_template:
                typeof selectedQuestion.coding_template === 'string' ? selectedQuestion.coding_template : null,
              coding_test_cases: Array.isArray(selectedQuestion.coding_test_cases)
                ? selectedQuestion.coding_test_cases
                : null,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      await this.prisma.session.update({
        where: { id: sessionId },
        data: { questions_asked: order },
      });

      return this.enrichRoundForClient(round, session.tech_stack);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(`Question retrieval failed: ${(error as Error).message}`, 500);
    }
  }

  async runCode(stack: string, code: string, stdin = ''): Promise<any> {
    const normalized = this.normalizeStack(stack);
    const runtimeMap: Record<string, { language: string; version: string }> = {
      nodejs: { language: 'javascript', version: '18.15.0' },
      react: { language: 'javascript', version: '18.15.0' },
      vue: { language: 'javascript', version: '18.15.0' },
      angular: { language: 'typescript', version: '5.0.3' },
      ember: { language: 'javascript', version: '18.15.0' },
      nextjs: { language: 'javascript', version: '18.15.0' },
      express: { language: 'javascript', version: '18.15.0' },
      python: { language: 'python', version: '3.10.0' },
      java: { language: 'java', version: '15.0.2' },
      dotnet: { language: 'csharp', version: '6.12.0' },
    };
    const runtime = runtimeMap[normalized] || runtimeMap.nodejs;
    if (!code?.trim()) {
      throw new HttpException('Code is required', 400);
    }

    const endpoint = process.env.PISTON_API_URL?.trim() || 'https://emkc.org/api/v2/piston/execute';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: runtime.language,
          version: runtime.version,
          files: [{ content: code }],
          stdin: stdin || '',
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text();
        throw new HttpException(`Code runner error: ${res.status} ${body}`, 502);
      }
      const data: any = await res.json();
      const run = data?.run || {};
      const compile = data?.compile || {};
      const stdout = run.stdout || '';
      const stderr = run.stderr || '';
      const compileOut = compile.output || '';
      return {
        language: runtime.language,
        success: run.code === 0 && !stderr,
        output: `${stdout}${stderr ? `\n${stderr}` : ''}`.trim(),
        stdout,
        stderr,
        compile_output: compileOut,
        exit_code: run.code,
      };
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        throw new HttpException('Code execution timed out', 504);
      }
      if (error instanceof HttpException) throw error;
      throw new HttpException(`Code execution failed: ${error?.message || 'Unknown error'}`, 500);
    } finally {
      clearTimeout(timer);
    }
  }

  async createRound(
    sessionId: string,
    questionId: string,
    user?: SessionUser,
    sessionSecret?: string | null,
  ): Promise<any> {
    return this.prisma.$transaction(
      async (tx) => {
        const session = await tx.session.findUnique({ where: { id: sessionId } });
        if (!session) throw new HttpException('Session not found', 404);
        this.assertSessionAccess(session, user, sessionSecret);
        if (session.status !== 'active') throw new HttpException('Session is not active', 400);

        const existingOpen = await tx.round.findFirst({
          where: { session_id: sessionId, answer: null },
          orderBy: { round_order: 'asc' },
        });
        if (existingOpen) {
          if (existingOpen.question_id === questionId) {
            return serializeRound(existingOpen);
          }
          throw new HttpException('A question is already in progress for this session', 409);
        }

        const question = await this.questionsService.getQuestionById(questionId);
        if (!question) throw new HttpException('Question not found', 404);

        const pastRounds = await tx.round.findMany({
          where: { session_id: sessionId },
          select: { round_order: true },
          orderBy: { round_order: 'asc' },
        });
        const maxOrder = pastRounds.length > 0 ? Math.max(...pastRounds.map((r) => r.round_order || 0)) : 0;
        if (maxOrder >= session.num_questions) {
          throw new HttpException('This session has already reached the configured number of questions', 400);
        }
        const order = maxOrder + 1;

        if (!session.user_id && session.ip_hash) {
          await this.reserveAnonInTx(tx, session.ip_hash);
        }

        const round = await tx.round.create({
          data: {
            id: uuidv4(),
            session_id: sessionId,
            round_order: order,
            question_id: question.id,
            question: question.question,
            question_type: question.question_type || 'conceptual',
            topic: question.topic || 'general',
            expected_key_points: question.expected_key_points || [],
            hint: question.hint || '',
            coding_template:
              typeof question.coding_template === 'string' ? question.coding_template : null,
            coding_test_cases: Array.isArray(question.coding_test_cases) ? question.coding_test_cases : null,
          },
        });

        await tx.session.update({
          where: { id: sessionId },
          data: { questions_asked: order },
        });

        return this.enrichRoundForClient(round, session.tech_stack);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async evaluateAnswer(
    sessionId: string,
    roundId: string,
    answer: string,
    user?: SessionUser,
    sessionSecret?: string | null,
  ): Promise<any> {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) throw new HttpException('Session not found', 404);
    this.assertSessionAccess(session, user, sessionSecret);

    const round = await this.prisma.round.findFirst({ where: { id: roundId, session_id: sessionId } });
    if (!round) throw new HttpException('Round not found', 404);

    const updatedRound = await this.evaluateRoundWithAi(session, round, answer);

    const scoredRounds = await this.prisma.round.findMany({
      where: { session_id: sessionId, score: { not: null } },
      select: { score: true },
    });
    if (scoredRounds.length) {
      const avg = scoredRounds.reduce((a, r) => a + (r.score || 0), 0) / scoredRounds.length;
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { avg_score: Math.round(avg * 10) / 10 },
      });
    }

    return this.enrichRoundForClient(updatedRound.round, session.tech_stack);
  }

  async submitAnswer(
    sessionId: string,
    roundId: string,
    answer: string,
    user?: SessionUser,
    sessionSecret?: string | null,
  ): Promise<any> {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) throw new HttpException('Session not found', 404);
    this.assertSessionAccess(session, user, sessionSecret);

    const round = await this.prisma.round.findFirst({ where: { id: roundId, session_id: sessionId } });
    if (!round) throw new HttpException('Round not found', 404);
    if (round.answer) throw new HttpException('Answer already submitted for this question', 409);

    const updated = await this.prisma.round.update({
      where: { id: roundId },
      data: { answer },
    });
    const evaluated = await this.evaluateRoundWithAi(session, updated, answer, { fastMode: true });
    return this.enrichRoundForClient(evaluated.round, session.tech_stack);
  }

  async updateSubmittedAnswer(
    sessionId: string,
    roundId: string,
    answer: string,
    user?: SessionUser,
    sessionSecret?: string | null,
  ): Promise<any> {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) throw new HttpException('Session not found', 404);
    this.assertSessionAccess(session, user, sessionSecret);
    if (session.status !== 'active') throw new HttpException('Session is not active', 400);

    const round = await this.prisma.round.findFirst({ where: { id: roundId, session_id: sessionId } });
    if (!round) throw new HttpException('Round not found', 404);
    if (!round.answer) throw new HttpException('Answer has not been submitted yet', 400);
    const updated = await this.prisma.round.update({
      where: { id: roundId },
      data: { answer },
    });
    const evaluated = await this.evaluateRoundWithAi(session, updated, answer, { fastMode: true });
    return this.enrichRoundForClient(evaluated.round, session.tech_stack);
  }

  async deleteAnswerAudio(
    sessionId: string,
    roundId: string,
    user?: SessionUser,
    sessionSecret?: string | null,
  ): Promise<any> {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) throw new HttpException('Session not found', 404);
    this.assertSessionAccess(session, user, sessionSecret);

    const round = await this.prisma.round.findFirst({ where: { id: roundId, session_id: sessionId } });
    if (!round) throw new HttpException('Round not found', 404);

    const audioUrl = round.answer_audio_url || '';
    if (audioUrl) {
      try {
        const fileName = basename(new URL(audioUrl).pathname);
        const filePath = join(process.cwd(), 'uploads', 'answers', fileName);
        if (existsSync(filePath)) unlinkSync(filePath);
      } catch {
        // Ignore filesystem cleanup errors and still clear DB fields.
      }
    }

    const updated = await this.prisma.round.update({
      where: { id: roundId },
      data: {
        answer_audio_url: null,
        answer_audio_mime_type: null,
        answer_audio_duration_ms: null,
      },
    });
    return this.enrichRoundForClient(updated, session.tech_stack);
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
    user?: SessionUser,
    sessionSecret?: string | null,
  ): Promise<any> {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) throw new HttpException('Session not found', 404);
    this.assertSessionAccess(session, user, sessionSecret);

    const round = await this.prisma.round.findFirst({ where: { id: roundId, session_id: sessionId } });
    if (!round) throw new HttpException('Round not found', 404);

    const baseUrl = `${data.protocol}://${data.host}`;
    const audioUrl = `${baseUrl}/uploads/answers/${data.fileName}`;
    const update: Prisma.RoundUpdateInput = {
      answer_audio_url: audioUrl,
      answer_audio_mime_type: data.mimeType || 'audio/webm',
      answer_audio_duration_ms: data.durationMs ?? null,
    };

    await this.prisma.round.update({ where: { id: roundId }, data: update });
    const merged = await this.prisma.round.findUnique({ where: { id: roundId } });
    return this.enrichRoundForClient(merged!, session.tech_stack);
  }

  async completeSession(sessionId: string, user?: SessionUser, sessionSecret?: string | null, userId?: string): Promise<any> {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) throw new HttpException('Session not found', 404);
    this.assertSessionAccess(session, user, sessionSecret);

    const allRounds = await this.prisma.round.findMany({
      where: { session_id: sessionId },
      orderBy: { round_order: 'asc' },
    });
    const pendingEvaluation = allRounds.filter((r) => r.answer && r.score === null);
    let aiStatus: 'evaluated' | 'not_configured' | 'rate_limited' | 'db_only' | 'none' = 'none';

    if (pendingEvaluation.length > 0) {
      const mode = this.evaluationMode();
      aiStatus = mode === 'db_only' ? 'db_only' : this.aiService.isConfigured() ? 'evaluated' : 'not_configured';
      for (const r of pendingEvaluation) {
        const outcome = await this.evaluateRoundWithAi(session, r, r.answer || '', { fastMode: true });
        if (outcome.mode === 'fallback' && this.aiService.isConfigured()) aiStatus = 'rate_limited';
      }
    }

    const rounds = await this.prisma.round.findMany({
      where: { session_id: sessionId, score: { not: null } },
    });
    const avg = rounds.length ? rounds.reduce((a, r) => a + (r.score || 0), 0) / rounds.length : null;
    const now = new Date();

    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'completed',
        avg_score: avg === null ? null : Math.round(avg * 10) / 10,
        completed_at: now,
      },
    });

    const updatedSession = await this.prisma.session.findUnique({ where: { id: sessionId } });
    const serialized = serializeSession(updatedSession!);
    const completedRounds = await this.prisma.round.findMany({
      where: { session_id: sessionId },
      orderBy: { round_order: 'asc' },
    });

    const effectiveUserId = userId || session.user_id;
    if (effectiveUserId && this.notifService) {
      this.notifService.onSessionComplete(effectiveUserId, serialized).catch(() => {});
    }

    return {
      session: serialized,
      rounds: completedRounds.map((r) => this.enrichRoundForClient(r, session.tech_stack)),
      ai_status: aiStatus,
    };
  }

  private async evaluateRoundWithAi(
    session: any,
    round: any,
    answer: string,
    options?: { fastMode?: boolean },
  ): Promise<{ mode: 'ai' | 'fallback'; round: any }> {
    const mode = this.evaluationMode();
    if (mode === 'db_only') {
      const updated = await this.evaluateRoundWithFallback(session, round, answer);
      return { mode: 'fallback', round: updated };
    }
    try {
    const prompt = this.buildEvalPrompt(
      session.tech_stack,
      session.category,
      session.difficulty,
      round.question,
      round.expected_key_points || [],
      answer,
    );

    const fastMode = Boolean(options?.fastMode);
    const response = await this.aiService.generate(
      prompt,
      'Evaluate this answer thoroughly now.',
      fastMode
        ? ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-pro']
        : ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
      fastMode ? { maxRetriesPerModel: 1, retryBackoffMs: 300, failFastOnRateLimit: true } : undefined,
    );
    const evalData = this.aiService.parseJson(response);

    const dimScores = evalData.dimension_scores || {};
    const parseScore = (v: unknown) => {
      const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0));
      if (!Number.isFinite(n)) return 0;
      return Math.max(0, Math.min(10, n));
    };
    const correctness = parseScore(dimScores.correctness);
    const depth = parseScore(dimScores.depth);
    const clarity = parseScore(dimScores.clarity);
    const practicality = parseScore(dimScores.practicality);
    let scoreVal =
      parseScore(evalData.score_overall) ||
      parseScore(evalData.score) ||
      Math.round((correctness * 0.4 + depth * 0.3 + clarity * 0.15 + practicality * 0.15) * 10) / 10;
    scoreVal = Math.round(scoreVal * 10) / 10;

    const toList = (v: unknown, fallback: string[] = []) =>
      Array.isArray(v)
        ? v.map((x) => String(x || '').trim()).filter(Boolean)
        : fallback;

    const strengths = toList(evalData.strengths);
    const weaknesses = toList(evalData.weaknesses);
    const missingKeyPoints = toList(evalData.missing_key_points);
    const evidenceForScore = toList(evalData.evidence_for_score);
    const improvementSuggestions = toList(evalData.improvement_suggestions);
    const next24hPlan = toList(evalData.next_24h_plan);
    const improvedAnswerExample = String(evalData.improved_answer_example || '').trim();
    const feedbackNarrative = String(evalData.feedback || '').trim();
    const rubricSummary = `Rubric scores -> Correctness: ${correctness}/10, Depth: ${depth}/10, Clarity: ${clarity}/10, Practicality: ${practicality}/10.`;
    const feedbackParts = [
      feedbackNarrative,
      rubricSummary,
      evidenceForScore.length ? `Evidence: ${evidenceForScore.join(' | ')}` : '',
      missingKeyPoints.length ? `Missing key points: ${missingKeyPoints.join('; ')}` : '',
      improvedAnswerExample ? `Improved answer example: ${improvedAnswerExample}` : '',
      next24hPlan.length ? `Next 24h plan: ${next24hPlan.join(' | ')}` : '',
    ].filter(Boolean);

    const update = {
      answer,
      score: scoreVal,
      feedback: feedbackParts.join('\n\n'),
      strengths: strengths.slice(0, 8),
      weaknesses: [...weaknesses, ...missingKeyPoints].slice(0, 10),
      follow_up_question: evalData.follow_up_question || '',
      improvement_suggestions: [...improvementSuggestions, ...next24hPlan].slice(0, 10),
      verdict: evalData.verdict || 'needs_improvement',
    };

      const updated = await this.prisma.round.update({ where: { id: round.id }, data: update });
      return { mode: 'ai', round: updated };
    } catch {
      if (mode === 'ai_only') {
        throw new HttpException('AI evaluation failed and fallback is disabled by EVAL_MODE=ai_only', 503);
      }
      const updated = await this.evaluateRoundWithFallback(session, round, answer);
      return { mode: 'fallback', round: updated };
    }
  }

  private tokenizeText(input: string): string[] {
    return String(input || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3);
  }

  private keyPointLikelyCovered(answerLower: string, keyPoint: string): boolean {
    const k = String(keyPoint || '')
      .trim()
      .toLowerCase();
    if (!k) return false;
    if (answerLower.includes(k)) return true;
    for (const seg of k.split(/[,;]+/)) {
      const s = seg.trim();
      if (s.length >= 3 && answerLower.includes(s)) return true;
    }
    const words = k.split(/\s+/).filter((w) => w.length >= 3);
    if (!words.length) return false;
    const hits = words.filter((w) => answerLower.includes(w));
    return hits.length >= Math.max(1, Math.ceil(words.length * 0.4));
  }

  private verdictFromScore(score: number): 'strong' | 'acceptable' | 'needs_improvement' | 'poor' {
    if (score >= 8.5) return 'strong';
    if (score >= 7) return 'acceptable';
    if (score >= 5) return 'needs_improvement';
    return 'poor';
  }

  private async evaluateRoundWithFallback(session: any, round: any, answer: string) {
    const answerText = String(answer || '').trim();
    const answerLower = answerText.toLowerCase();
    const expected = Array.isArray(round.expected_key_points) ? round.expected_key_points.map((p: any) => String(p || '')) : [];
    const questionRow = round.question_id
      ? await this.prisma.question.findUnique({
          where: { id: round.question_id },
          select: { sample_answer: true },
        })
      : null;
    const sampleAnswers = Array.isArray(questionRow?.sample_answer)
      ? questionRow!.sample_answer.map((s) => String(s || '').trim()).filter(Boolean)
      : [];

    const covered = expected.filter((p) => this.keyPointLikelyCovered(answerLower, p));
    const missing = expected.filter((p) => !this.keyPointLikelyCovered(answerLower, p));
    const coverage = expected.length > 0 ? covered.length / expected.length : 0.5;

    const answerTokens = new Set(this.tokenizeText(answerText));
    const referenceTokens = new Set(
      this.tokenizeText(`${expected.join(' ')} ${sampleAnswers.join(' ')}`),
    );
    let overlapCount = 0;
    for (const t of answerTokens) {
      if (referenceTokens.has(t)) overlapCount += 1;
    }
    const tokenOverlap = answerTokens.size > 0 ? overlapCount / answerTokens.size : 0;
    const lengthScore = Math.min(1, answerText.length / 400);
    let raw =
      (expected.length > 0 ? coverage * 0.5 : 0.25) + tokenOverlap * 0.35 + lengthScore * 0.15;
    if (answerText.length > 40 && answerText.length < 120) raw *= 0.85;
    let scoreVal = Math.round(Math.max(0, Math.min(10, raw * 10)) * 10) / 10;
    if (answerText.length < 20) scoreVal = Math.min(scoreVal, 3);
    if (answerText.length > 30 && scoreVal < 2.5) scoreVal = 2.5;
    const verdict = this.verdictFromScore(scoreVal);

    const strengths = [
      covered.length ? `Covered ${covered.length}/${Math.max(expected.length, 1)} expected key points.` : '',
      tokenOverlap >= 0.35 ? 'Used relevant technical terminology from the topic.' : '',
      answerText.length > 180 ? 'Provided reasonably detailed explanation.' : '',
    ].filter(Boolean);
    const weaknesses = [
      missing.length ? `Missing key concepts: ${missing.slice(0, 4).join('; ')}` : '',
      answerText.length < 80 ? 'Answer is too short; add deeper explanation and examples.' : '',
      tokenOverlap < 0.2 ? 'Low technical relevance; align answer with expected concepts.' : '',
    ].filter(Boolean);
    const suggestions = [
      missing.length ? `Include these points explicitly: ${missing.slice(0, 4).join('; ')}` : 'Add one concrete example from real-world use.',
      sampleAnswers[0] ? `Model direction: ${sampleAnswers[0]}` : 'Structure response as definition -> approach -> trade-offs -> example.',
      'Practice 3 variations of this question and compare your answers against key points.',
    ];
    const feedback = [
      '[evaluation_source: database_fallback]',
      'Scored using DB-backed fallback evaluator: offline reference model (used when AI is unavailable).',
      `Summary: Your answer ${expected.length ? `aligns with about ${covered.length} of ${expected.length} key themes` : 'is compared against the question bank reference'} for this topic. Technical overlap score: ${(tokenOverlap * 100).toFixed(0)}%.`,
      missing.length
        ? `Gaps: weave in: ${missing.slice(0, 3).join('; ')}.`
        : 'Strength: you hit the main expected angles for this question.',
      sampleAnswers.length
        ? `Model outline (from question bank, not your score):\n${sampleAnswers
            .slice(0, 2)
            .map((s, i) => `${i + 1}. ${s}`)
            .join('\n')}`
        : 'Tip: structure answers as definition, example, then trade-offs or testing.',
    ]
      .filter(Boolean)
      .join('\n\n');

    return this.prisma.round.update({
      where: { id: round.id },
      data: {
        answer,
        score: scoreVal,
        feedback,
        strengths: strengths.slice(0, 8),
        weaknesses: weaknesses.slice(0, 10),
        follow_up_question: `Can you improve your answer by explaining one trade-off and one real implementation example for "${round.question}"?`,
        improvement_suggestions: suggestions.slice(0, 10),
        verdict,
      },
    });
  }

  private buildEvalPrompt(
    techStack: string,
    category: string,
    difficulty: string,
    question: string,
    expectedKeyPoints: string[],
    answer: string,
  ): string {
    const grillMap: Record<string, string> = {
      beginner: 'Be supportive and educational. Provide detailed guidance on what was right and wrong. Still identify areas for improvement clearly.',
      intermediate: 'Be moderately strict. Point out weaknesses firmly. Provide one challenging follow-up question that digs deeper.',
      advanced: 'Be VERY strict and aggressive. Challenge every weak point in the answer. Grill the candidate hard with a deep, tricky follow-up question that exposes gaps.',
    };
    const keyPointsText = expectedKeyPoints?.length
      ? expectedKeyPoints.map((k, i) => `${i + 1}. ${k}`).join('\n')
      : 'No predefined key points were provided.';
    return `You are a strict technical interviewer evaluating a ${difficulty}-level candidate's answer for ${techStack} (${category}).
${grillMap[difficulty] || grillMap.intermediate}

Question asked: ${question}
Expected key points:
${keyPointsText}

Candidate's answer: ${answer}

Evaluation rules:
1) Use this rubric and produce dimension scores (0-10):
   - correctness (40%)
   - depth (30%)
   - clarity (15%)
   - practicality (15%)
2) Provide concrete evidence by quoting short snippets from the candidate answer.
3) List which expected key points are missing or weak.
4) Give one short improved answer example that demonstrates a better response.
5) Give immediate, actionable next 24h practice plan.

Return ONLY valid JSON (no markdown, no extra text) with this shape:
{"score_overall":<number 0-10>,"dimension_scores":{"correctness":<0-10>,"depth":<0-10>,"clarity":<0-10>,"practicality":<0-10>},"feedback":"2-4 sentence evaluation","strengths":["strength1","strength2"],"weaknesses":["weakness1","weakness2"],"evidence_for_score":["quote or reference 1","quote or reference 2"],"missing_key_points":["point1","point2"],"improved_answer_example":"short better sample answer","next_24h_plan":["action1","action2"],"follow_up_question":"a grilling follow-up question","improvement_suggestions":["suggestion1","suggestion2"],"verdict":"strong|acceptable|needs_improvement|poor"}`;
  }
}
