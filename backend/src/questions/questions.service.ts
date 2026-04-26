import { Injectable, HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { buildQuestionBank } from './question-bank';
import { buildReferenceSampleAnswer, type Difficulty } from './question-reference';

@Injectable()
export class QuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  private codingTemplateForStack(stack: string, topic: string): string {
    const normalized = this.normalizeStack(stack);
    if (normalized === 'python') {
      return `# Stack: ${normalized}\n# Topic: ${topic}
def solve(input_text: str) -> str:
    # TODO: implement
    return input_text.strip()

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))`;
    }
    if (normalized === 'java') {
      return `// Stack: ${normalized}\n// Topic: ${topic}
import java.io.*;
public class Main {
    static String solve(String input) {
        // TODO: implement
        return input.trim();
    }
    public static void main(String[] args) throws Exception {
        String input = new String(System.in.readAllBytes());
        System.out.print(solve(input));
    }
}`;
    }
    if (normalized === 'dotnet') {
      return `// Stack: ${normalized}\n// Topic: ${topic}
using System;
public class Program {
    static string Solve(string input) {
        // TODO: implement
        return input.Trim();
    }
    public static void Main() {
        Console.Write(Solve(Console.In.ReadToEnd()));
    }
}`;
    }
    if (normalized === 'angular') {
      return `// Stack: ${normalized}\n// Topic: ${topic}
import * as fs from "fs";
function solve(input: string): string {
  // TODO: implement
  return input.trim();
}
console.log(solve(fs.readFileSync(0, "utf8")));`;
    }
    return `// Stack: ${normalized}\n// Topic: ${topic}
const fs = require("fs");
function solve(input) {
  // TODO: implement
  return input.trim();
}
process.stdout.write(String(solve(fs.readFileSync(0, "utf8"))));`;
  }

  private codingTestCasesForTopic(topic: string) {
    const normalizedTopic = (topic || '').toLowerCase();
    if (normalizedTopic.includes('sort')) {
      return [
        { label: 'Case 1', input: '3 1 2\n', expected_output: '1 2 3' },
        { label: 'Case 2', input: '10 5 7 1\n', expected_output: '1 5 7 10' },
      ];
    }
    if (normalizedTopic.includes('string')) {
      return [
        { label: 'Case 1', input: 'hello\n', expected_output: 'hello' },
        { label: 'Case 2', input: 'Interview Grill\n', expected_output: 'Interview Grill' },
      ];
    }
    return [
      { label: 'Case 1', input: 'sample input\n', expected_output: 'sample input' },
      { label: 'Case 2', input: 'another sample\n', expected_output: 'another sample' },
    ];
  }

  private normalizeStack(value?: string): string {
    const raw = (value || '').trim().toLowerCase();
    if (!raw) return '';
    const normalized = raw.replace(/\s+/g, '').replace(/\./g, '');
    const aliases: Record<string, string> = {
      node: 'nodejs',
      nodejs: 'nodejs',
      'node.js': 'nodejs',
      reactjs: 'react',
      react: 'react',
      angularjs: 'angular',
      angular: 'angular',
      vuejs: 'vue',
      vue: 'vue',
      emberjs: 'ember',
      ember: 'ember',
      nextjs: 'nextjs',
      next: 'nextjs',
      expressjs: 'express',
      express: 'express',
      python: 'python',
      java: 'java',
      'c#': 'dotnet',
      dotnet: 'dotnet',
      net: 'dotnet',
    };
    return aliases[normalized] || normalized;
  }

  private normalizeDifficulty(value?: string): string {
    const normalized = (value || '').trim().toLowerCase();
    const map: Record<string, string> = {
      beginner: 'easy',
      intermediate: 'medium',
      advanced: 'hard',
      easy: 'easy',
      medium: 'medium',
      hard: 'hard',
    };
    return map[normalized] || normalized;
  }

  private toReferenceDifficulty(value?: string): Difficulty {
    const d = this.normalizeDifficulty(value);
    if (d === 'easy' || d === 'medium' || d === 'hard') return d;
    return 'medium';
  }

  async createQuestion(questionData: Partial<any>): Promise<any> {
    const normalizedStack = this.normalizeStack((questionData as any).stack || (questionData as any).tech_stack);
    const normalizedDifficulty = this.normalizeDifficulty((questionData as any).difficulty);
    if (!normalizedStack) throw new HttpException('stack is required', 400);
    if (!['easy', 'medium', 'hard'].includes(normalizedDifficulty)) {
      throw new HttpException('difficulty must be easy, medium, or hard', 400);
    }

    const id = (questionData as any).id || uuidv4();
    const baseCreate = {
      id,
      stack: normalizedStack,
      tech_stack: normalizedStack,
      difficulty: normalizedDifficulty,
      question_type: (questionData as any).question_type || 'conceptual',
      category: (questionData as any).category || 'general',
      topic: (questionData as any).topic || 'general',
      question: (questionData as any).question || '',
      expected_key_points: Array.isArray((questionData as any).expected_key_points)
        ? (questionData as any).expected_key_points
        : [],
      hint: (questionData as any).hint || '',
      coding_template:
        typeof (questionData as any).coding_template === 'string'
          ? (questionData as any).coding_template
          : null,
      coding_test_cases: Array.isArray((questionData as any).coding_test_cases)
        ? (questionData as any).coding_test_cases
        : null,
      tags: Array.isArray((questionData as any).tags) ? (questionData as any).tags : [],
      sample_answer: Array.isArray((questionData as any).sample_answer) ? (questionData as any).sample_answer : [],
      is_active: (questionData as any).is_active ?? true,
    };
    return this.prisma.question.upsert({
      where: { id },
      create: baseCreate,
      update: {
        stack: normalizedStack,
        tech_stack: normalizedStack,
        difficulty: normalizedDifficulty,
        question_type: baseCreate.question_type,
        category: baseCreate.category,
        topic: baseCreate.topic,
        question: baseCreate.question,
        expected_key_points: baseCreate.expected_key_points,
        hint: baseCreate.hint,
        coding_template: baseCreate.coding_template,
        coding_test_cases: baseCreate.coding_test_cases,
        tags: baseCreate.tags,
        sample_answer: baseCreate.sample_answer,
        is_active: baseCreate.is_active,
      },
    });
  }

  private shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  async getQuestions(filters: {
    stack?: string;
    tech_stack?: string;
    difficulty?: string;
    excludeIds?: string[];
    limit?: number;
  } = {}): Promise<any[]> {
    const limit = Number(filters.limit || 10);
    if (Number.isNaN(limit) || limit <= 0 || limit > 100) {
      throw new HttpException('limit must be between 1 and 100', 400);
    }

    const stack = this.normalizeStack(filters.stack || filters.tech_stack);
    const difficulty = this.normalizeDifficulty(filters.difficulty);
    const where: Prisma.QuestionWhereInput = { is_active: true };
    if (stack) {
      where.OR = [{ stack }, { tech_stack: stack }];
    }
    if (difficulty) where.difficulty = difficulty;
    if (filters.excludeIds?.length) {
      where.id = { notIn: filters.excludeIds };
    }

    const pool = await this.prisma.question.findMany({
      where,
      take: Math.min(Math.max(limit * 8, 40), 400),
    });

    const results = this.shuffle(pool).slice(0, limit);

    if (results.length > 0 || !stack) {
      return results.map((q) => ({
        id: q.id,
        question: q.question,
        stack: q.stack || q.tech_stack || '',
        difficulty: q.difficulty,
        tags: q.tags || [],
        question_type: q.question_type || 'conceptual',
        topic: q.topic || 'general',
        expected_key_points: q.expected_key_points || [],
        hint: q.hint || '',
        coding_template: q.coding_template || null,
        coding_test_cases: q.coding_test_cases || null,
      }));
    }

    const fallbackWhere: Prisma.QuestionWhereInput = { is_active: true };
    if (difficulty) fallbackWhere.difficulty = difficulty;
    if (filters.excludeIds?.length) fallbackWhere.id = { notIn: filters.excludeIds };

    const pool2 = await this.prisma.question.findMany({
      where: fallbackWhere,
      take: Math.min(Math.max(limit * 8, 40), 400),
    });
    return this.shuffle(pool2)
      .slice(0, limit)
      .map((q) => ({
        id: q.id,
        question: q.question,
        stack: q.stack || q.tech_stack || '',
        difficulty: q.difficulty,
        tags: q.tags || [],
        question_type: q.question_type || 'conceptual',
        topic: q.topic || 'general',
        expected_key_points: q.expected_key_points || [],
        hint: q.hint || '',
        coding_template: q.coding_template || null,
        coding_test_cases: q.coding_test_cases || null,
      }));
  }

  async getQuestionById(questionId: string): Promise<any> {
    const question = await this.prisma.question.findFirst({
      where: { id: questionId, is_active: true },
    });
    if (!question) throw new HttpException('Question not found', 404);
    const { sample_answer: _sa, ...rest } = question;
    return rest;
  }

  async getRandomQuestions(filters: {
    stack?: string;
    tech_stack?: string;
    difficulty?: string;
    count: string | number;
    excludeIds?: string[];
  }): Promise<any[]> {
    const count = typeof filters.count === 'string' ? parseInt(filters.count, 10) : filters.count;
    if (isNaN(count) || count <= 0) {
      throw new HttpException('Invalid count parameter', 400);
    }

    return this.getQuestions({
      stack: filters.stack || filters.tech_stack,
      difficulty: filters.difficulty,
      excludeIds: filters.excludeIds || [],
      limit: count,
    });
  }

  async updateQuestion(questionId: string, updateData: Partial<any>): Promise<any> {
    const question = await this.prisma.question.update({
      where: { id: questionId },
      data: {
        ...updateData,
        updated_at: new Date(),
      } as any,
    });
    return question;
  }

  async updateCodingAssets(
    questionId: string,
    assets: {
      coding_template?: string | null;
      coding_test_cases?: Array<{ label: string; input: string; expected_output: string }> | null;
    },
  ): Promise<any> {
    const codingTestCases =
      assets.coding_test_cases == null
        ? null
        : Array.isArray(assets.coding_test_cases)
          ? assets.coding_test_cases.map((x, idx) => ({
              label: String(x?.label || `Case ${idx + 1}`),
              input: String(x?.input || ''),
              expected_output: String(x?.expected_output || ''),
            }))
          : null;

    const updated = await this.prisma.question.update({
      where: { id: questionId },
      data: {
        coding_template: typeof assets.coding_template === 'string' ? assets.coding_template : null,
        coding_test_cases: codingTestCases,
      } as any,
    });
    return {
      id: updated.id,
      question_type: updated.question_type,
      coding_template: updated.coding_template,
      coding_test_cases: updated.coding_test_cases,
      updated_at: updated.updated_at,
    };
  }

  async deleteQuestion(questionId: string): Promise<void> {
    try {
      await this.prisma.question.update({
        where: { id: questionId },
        data: { is_active: false, updated_at: new Date() },
      });
    } catch {
      throw new HttpException('Question not found', 404);
    }
  }

  async getQuestionStats(): Promise<any> {
    const rows = await this.prisma.question.findMany({
      where: { is_active: true },
      select: { tech_stack: true, stack: true, difficulty: true },
    });
    const byTechStack: Record<string, number> = {};
    const byDifficulty: Record<string, number> = {};
    for (const r of rows) {
      const k = r.stack || r.tech_stack || 'unknown';
      byTechStack[k] = (byTechStack[k] || 0) + 1;
      byDifficulty[r.difficulty] = (byDifficulty[r.difficulty] || 0) + 1;
    }
    return {
      totalQuestions: rows.length,
      byTechStack,
      byDifficulty,
    };
  }

  async seedQuestions(): Promise<void> {
    const questionBank = buildQuestionBank();
    for (const question of questionBank) {
      await this.prisma.question.upsert({
        where: { id: question.id },
        create: question as any,
        update: question as any,
      });
    }
    const codingRows = await this.prisma.question.findMany({
      where: { is_active: true, question_type: 'coding' },
      select: { id: true, stack: true, tech_stack: true, topic: true, coding_template: true, coding_test_cases: true },
    });
    for (const q of codingRows) {
      const hasTemplate = typeof q.coding_template === 'string' && q.coding_template.trim().length > 0;
      const hasTests = Array.isArray(q.coding_test_cases) && q.coding_test_cases.length > 0;
      if (hasTemplate && hasTests) continue;
      const stack = q.stack || q.tech_stack || 'nodejs';
      await this.prisma.question.update({
        where: { id: q.id },
        data: {
          coding_template: hasTemplate ? q.coding_template : this.codingTemplateForStack(stack, q.topic || 'general'),
          coding_test_cases: hasTests ? q.coding_test_cases : this.codingTestCasesForTopic(q.topic || 'general'),
        },
      });
    }
    const noSampleRows = await this.prisma.question.findMany({
      where: { is_active: true, sample_answer: { equals: [] } },
      select: { id: true, stack: true, tech_stack: true, topic: true, difficulty: true, question_type: true },
    });
    for (const q of noSampleRows) {
      const stack = q.stack || q.tech_stack || 'nodejs';
      await this.prisma.question.update({
        where: { id: q.id },
        data: {
          sample_answer: buildReferenceSampleAnswer(
            stack,
            q.topic || 'general',
            this.toReferenceDifficulty(q.difficulty),
            (q.question_type || 'conceptual') as 'conceptual' | 'coding' | 'scenario',
          ),
        },
      });
    }
    const stats = await this.getQuestionStats();
    const minPerStack = 100;
    const lowStacks = Object.entries(stats.byTechStack || {}).filter(
      ([, count]) => Number(count || 0) < minPerStack,
    );
    if (lowStacks.length) {
      const desc = lowStacks.map(([stack, count]) => `${stack}=${count}`).join(', ');
      throw new HttpException(
        `Question seeding completed but below target (${minPerStack}/stack): ${desc}`,
        500,
      );
    }
  }
}
