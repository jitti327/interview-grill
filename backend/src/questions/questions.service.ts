import { Injectable, HttpException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Question } from '../schemas/question.schema';

@Injectable()
export class QuestionsService {
  constructor(
    @InjectModel(Question.name) private questionModel: Model<Question>,
  ) {}

  private normalizeStack(value?: string): string {
    const raw = (value || '').trim().toLowerCase();
    if (!raw) return '';
    const normalized = raw.replace(/\s+/g, '').replace(/\./g, '');
    const aliases: Record<string, string> = {
      'node': 'nodejs',
      'nodejs': 'nodejs',
      'node.js': 'nodejs',
      'reactjs': 'react',
      'react': 'react',
      'angularjs': 'angular',
      'angular': 'angular',
      'vuejs': 'vue',
      'vue': 'vue',
      'emberjs': 'ember',
      'ember': 'ember',
      'nextjs': 'nextjs',
      'next': 'nextjs',
      'expressjs': 'express',
      'express': 'express',
      'python': 'python',
      'java': 'java',
      'c#': 'dotnet',
      'dotnet': 'dotnet',
      'net': 'dotnet',
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

  async createQuestion(questionData: Partial<Question>): Promise<Question> {
    const normalizedStack = this.normalizeStack((questionData as any).stack || (questionData as any).tech_stack);
    const normalizedDifficulty = this.normalizeDifficulty((questionData as any).difficulty);
    if (!normalizedStack) throw new HttpException('stack is required', 400);
    if (!['easy', 'medium', 'hard'].includes(normalizedDifficulty)) {
      throw new HttpException('difficulty must be easy, medium, or hard', 400);
    }

    const question = {
      id: (questionData as any).id || uuidv4(),
      ...questionData,
      stack: normalizedStack,
      tech_stack: normalizedStack,
      difficulty: normalizedDifficulty,
      tags: Array.isArray((questionData as any).tags) ? (questionData as any).tags : [],
      created_at: (questionData as any).created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: (questionData as any).is_active ?? true,
    } as any;

    return this.questionModel.create(question as Question);
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
    const query: any = { is_active: true };
    if (stack) query.$or = [{ stack }, { tech_stack: stack }];
    if (difficulty) query.difficulty = difficulty;
    if (filters.excludeIds?.length) query.id = { $nin: filters.excludeIds };

    const results = await this.questionModel.aggregate([
      { $match: query },
      { $sample: { size: limit } },
      {
        $project: {
          _id: 0,
          id: 1,
          question: 1,
          stack: { $ifNull: ['$stack', '$tech_stack'] },
          difficulty: 1,
          tags: { $ifNull: ['$tags', []] },
          question_type: { $ifNull: ['$question_type', 'conceptual'] },
          topic: { $ifNull: ['$topic', 'general'] },
          expected_key_points: { $ifNull: ['$expected_key_points', []] },
          hint: { $ifNull: ['$hint', ''] },
        },
      },
    ]);

    if (results.length > 0 || !stack) return results;

    // Graceful fallback when a requested stack has no seeded questions yet.
    return this.questionModel.aggregate([
      {
        $match: {
          is_active: true,
          ...(difficulty ? { difficulty } : {}),
          ...(filters.excludeIds?.length ? { id: { $nin: filters.excludeIds } } : {}),
        },
      },
      { $sample: { size: limit } },
      {
        $project: {
          _id: 0,
          id: 1,
          question: 1,
          stack: { $ifNull: ['$stack', '$tech_stack'] },
          difficulty: 1,
          tags: { $ifNull: ['$tags', []] },
          question_type: { $ifNull: ['$question_type', 'conceptual'] },
          topic: { $ifNull: ['$topic', 'general'] },
          expected_key_points: { $ifNull: ['$expected_key_points', []] },
          hint: { $ifNull: ['$hint', ''] },
        },
      },
    ]);
  }

  async getQuestionById(questionId: string): Promise<any> {
    const question = await this.questionModel.findOne(
      { id: questionId, is_active: true },
      { _id: 0, __v: 0 }
    ).lean();
    
    if (!question) throw new HttpException('Question not found', 404);
    return question;
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

  async updateQuestion(questionId: string, updateData: Partial<Question>): Promise<any> {
    const update = {
      ...updateData,
      updated_at: new Date().toISOString(),
    };

    const question = await this.questionModel.findOneAndUpdate(
      { id: questionId },
      { $set: update },
      { new: true, projection: { _id: 0, __v: 0 } }
    ).lean();

    if (!question) throw new HttpException('Question not found', 404);
    return question;
  }

  async deleteQuestion(questionId: string): Promise<void> {
    const result = await this.questionModel.updateOne(
      { id: questionId },
      { $set: { is_active: false, updated_at: new Date().toISOString() } }
    );

    if (result.matchedCount === 0) throw new HttpException('Question not found', 404);
  }

  async getQuestionStats(): Promise<any> {
    const stats = await this.questionModel.aggregate([
      { $match: { is_active: true } },
      {
        $group: {
          _id: null,
          totalQuestions: { $sum: 1 },
          byTechStack: {
            $push: {
              tech_stack: '$tech_stack',
              count: 1
            }
          },
          byDifficulty: {
            $push: {
              difficulty: '$difficulty',
              count: 1
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalQuestions: 1,
          byTechStack: {
            $reduce: {
              input: '$byTechStack',
              initialValue: {},
              in: {
                $mergeObjects: [
                  '$$value',
                  {
                    $arrayToObject: [
                      [
                        {
                          k: '$$this.tech_stack',
                          v: {
                            $add: [
                              { $ifNull: [{ $getField: { field: '$$this.tech_stack', input: '$$value' } }, 0] },
                              1
                            ]
                          }
                        }
                      ]
                    ]
                  }
                ]
              }
            }
          },
          byDifficulty: {
            $reduce: {
              input: '$byDifficulty',
              initialValue: {},
              in: {
                $mergeObjects: [
                  '$$value',
                  {
                    $arrayToObject: [
                      [
                        {
                          k: '$$this.difficulty',
                          v: {
                            $add: [
                              { $ifNull: [{ $getField: { field: '$$this.difficulty', input: '$$value' } }, 0] },
                              1
                            ]
                          }
                        }
                      ]
                    ]
                  }
                ]
              }
            }
          }
        }
      }
    ]);

    return stats[0] || { totalQuestions: 0, byTechStack: {}, byDifficulty: {} };
  }

  async seedQuestions(): Promise<void> {
    const stacks = ['angular', 'nodejs', 'react', 'ember', 'vue', 'nextjs', 'express', 'python', 'java', 'dotnet'];
    const difficulties = ['easy', 'medium', 'hard'];
    const questionTypes = ['conceptual', 'coding', 'scenario'];
    const topics = [
      'fundamentals',
      'performance',
      'testing',
      'architecture',
      'security',
      'state-management',
      'apis',
      'error-handling',
      'debugging',
      'best-practices',
    ];

    for (const stack of stacks) {
      for (let i = 0; i < 20; i += 1) {
        const difficulty = difficulties[i % difficulties.length];
        const topic = topics[i % topics.length];
        const question = {
          id: `${stack}-${difficulty}-${i + 1}`,
          stack,
          tech_stack: stack,
          difficulty,
          question_type: questionTypes[i % questionTypes.length],
          topic,
          category: topic,
          question: `[${stack.toUpperCase()}] ${difficulty} interview question ${i + 1}: Explain how you would handle ${topic} in a production system.`,
          expected_key_points: [
            `Demonstrates core ${stack} knowledge`,
            `Explains trade-offs for ${topic}`,
            'Mentions testing and monitoring',
          ],
          hint: `Focus on practical ${stack} patterns for ${topic}.`,
          tags: [stack, difficulty, topic],
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        await this.questionModel.updateOne({ id: question.id }, { $set: question }, { upsert: true });
      }
    }
  }
}
