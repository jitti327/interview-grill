import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Session } from '../schemas/session.schema';
import { Round } from '../schemas/round.schema';
import { User } from '../schemas/user.schema';
import { HttpException } from '@nestjs/common';
import { AiService } from '../ai/ai.service';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Session.name) private sessionModel: Model<Session>,
    @InjectModel(Round.name) private roundModel: Model<Round>,
    @InjectModel(User.name) private userModel: Model<User>,
    private aiService: AiService,
  ) {}

  async overview() {
    const total = await this.sessionModel.countDocuments();
    const completed = await this.sessionModel.countDocuments({ status: 'completed' });
    const pipeline = [
      { $match: { status: 'completed', avg_score: { $ne: null } } },
      { $group: { _id: null, avg: { $avg: '$avg_score' } } },
    ];
    const result = await this.sessionModel.aggregate(pipeline);
    const overallAvg = result.length ? Math.round(result[0].avg * 10) / 10 : 0;
    const recent = await this.sessionModel.find(
      { status: 'completed' }, { _id: 0, __v: 0 },
    ).sort({ completed_at: -1 }).limit(10).lean();

    return { total_sessions: total, completed_sessions: completed, overall_avg_score: overallAvg, recent_sessions: recent };
  }

  async skillRadar() {
    const pipeline = [
      { $match: { status: 'completed', avg_score: { $ne: null } } },
      { $group: { _id: '$category', avg_score: { $avg: '$avg_score' }, count: { $sum: 1 } } },
    ];
    const results = await this.sessionModel.aggregate(pipeline);
    return results.map((r) => ({
      category: r._id, avg_score: Math.round(r.avg_score * 10) / 10, sessions: r.count,
    }));
  }

  async trend() {
    return this.sessionModel.find(
      { status: 'completed', avg_score: { $ne: null } },
      { _id: 0, id: 1, avg_score: 1, category: 1, tech_stack: 1, difficulty: 1, completed_at: 1 },
    ).sort({ completed_at: 1 }).limit(50).lean();
  }

  async categoryStats() {
    const pipeline = [
      { $match: { status: 'completed', avg_score: { $ne: null } } },
      { $group: { _id: { category: '$category', difficulty: '$difficulty' }, avg_score: { $avg: '$avg_score' }, count: { $sum: 1 } } },
    ];
    const results = await this.sessionModel.aggregate(pipeline);
    return results.map((r) => ({
      category: r._id.category, difficulty: r._id.difficulty,
      avg_score: Math.round(r.avg_score * 10) / 10, sessions: r.count,
    }));
  }

  async weakTopics() {
    const pipeline: any[] = [
      { $match: { score: { $ne: null }, topic: { $ne: null } } },
      { $group: { _id: '$topic', avg_score: { $avg: '$score' }, count: { $sum: 1 } } },
      { $match: { count: { $gte: 1 } } },
      { $sort: { avg_score: 1 } },
      { $limit: 15 },
    ];
    const results = await this.roundModel.aggregate(pipeline);
    return results.map((r) => ({
      topic: r._id, avg_score: Math.round(r.avg_score * 10) / 10, attempts: r.count,
    }));
  }

  async comparison(session1Id: string, session2Id: string) {
    const s1 = await this.sessionModel.findOne({ id: session1Id }, { _id: 0, __v: 0 }).lean();
    const s2 = await this.sessionModel.findOne({ id: session2Id }, { _id: 0, __v: 0 }).lean();
    if (!s1 || !s2) throw new HttpException('One or both sessions not found', 404);

    const r1 = await this.roundModel.find({ session_id: session1Id, score: { $ne: null } }, { _id: 0, __v: 0 }).sort({ order: 1 }).lean();
    const r2 = await this.roundModel.find({ session_id: session2Id, score: { $ne: null } }, { _id: 0, __v: 0 }).sort({ order: 1 }).lean();

    const scoreA = s1.avg_score || 0;
    const scoreB = s2.avg_score || 0;
    const winner = scoreA > scoreB ? 'a' : scoreB > scoreA ? 'b' : 'tie';

    return { session_a: s1, session_b: s2, rounds_a: r1, rounds_b: r2, winner };
  }

  async leaderboard(limit = 20): Promise<any[]> {
    const pipeline: any[] = [
      { $match: { status: 'completed', avg_score: { $ne: null }, user_id: { $ne: null } } },
      { $group: {
        _id: '$user_id',
        avg_score: { $avg: '$avg_score' },
        total_sessions: { $sum: 1 },
        best_score: { $max: '$avg_score' },
        categories: { $addToSet: '$category' },
      }},
      { $sort: { avg_score: -1 } },
      { $limit: limit },
    ];
    const results = await this.sessionModel.aggregate(pipeline);

    const enriched = await Promise.all(
      results.map(async (r, idx) => {
        let userName = 'Anonymous';
        if (r._id) {
          try {
            const user = await this.userModel.findById(r._id).lean();
            if (user) userName = (user as any).name || (user as any).email;
          } catch {}
        }
        return {
          rank: idx + 1,
          user_name: userName,
          avg_score: Math.round(r.avg_score * 10) / 10,
          total_sessions: r.total_sessions,
          best_score: Math.round(r.best_score * 10) / 10,
          categories: r.categories,
        };
      }),
    );
    return enriched;
  }

  async studyPlan(userId?: string): Promise<any> {
    const query: any = { score: { $ne: null }, topic: { $ne: null } };

    const weakPipeline: any[] = [
      { $match: query },
      { $group: { _id: '$topic', avg_score: { $avg: '$score' }, count: { $sum: 1 } } },
      { $sort: { avg_score: 1 } },
      { $limit: 10 },
    ];
    const weakTopics = await this.roundModel.aggregate(weakPipeline);

    const strongPipeline: any[] = [
      { $match: query },
      { $group: { _id: '$topic', avg_score: { $avg: '$score' }, count: { $sum: 1 } } },
      { $sort: { avg_score: -1 } },
      { $limit: 5 },
    ];
    const strongTopics = await this.roundModel.aggregate(strongPipeline);

    const totalSessions = await this.sessionModel.countDocuments({ status: 'completed' });

    const weakList = weakTopics.map(t => `${t._id} (avg: ${Math.round(t.avg_score * 10) / 10}/10, ${t.count} attempts)`).join(', ');
    const strongList = strongTopics.map(t => `${t._id} (avg: ${Math.round(t.avg_score * 10) / 10}/10)`).join(', ');

    if (weakTopics.length === 0) {
      return {
        weak_topics: [],
        strong_topics: [],
        plan: 'Complete a few interviews first to generate a personalized study plan.',
        ai_generated: false,
      };
    }

    try {
      const prompt = `You are a senior technical interview coach. Based on this candidate's data, create a focused study plan.

Weak areas: ${weakList}
Strong areas: ${strongList}
Total completed interviews: ${totalSessions}

Create a JSON study plan:
{"weekly_plan":[{"week":1,"focus":"topic","tasks":["task1","task2"],"goal":"what to achieve"}],"priority_topics":["topic1","topic2"],"estimated_weeks":N,"tips":["tip1","tip2"]}

Return ONLY valid JSON.`;

      const response = await this.aiService.generate(prompt, 'Generate the study plan now.');
      const plan = this.aiService.parseJson(response);

      return {
        weak_topics: weakTopics.map(t => ({ topic: t._id, avg_score: Math.round(t.avg_score * 10) / 10, attempts: t.count })),
        strong_topics: strongTopics.map(t => ({ topic: t._id, avg_score: Math.round(t.avg_score * 10) / 10, attempts: t.count })),
        plan,
        ai_generated: true,
      };
    } catch {
      return {
        weak_topics: weakTopics.map(t => ({ topic: t._id, avg_score: Math.round(t.avg_score * 10) / 10, attempts: t.count })),
        strong_topics: strongTopics.map(t => ({ topic: t._id, avg_score: Math.round(t.avg_score * 10) / 10, attempts: t.count })),
        plan: {
          priority_topics: weakTopics.slice(0, 5).map(t => t._id),
          tips: ['Focus on your weakest areas first', 'Practice daily for consistency', 'Review strong topics to maintain them'],
        },
        ai_generated: false,
      };
    }
  }
}
