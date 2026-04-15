import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Session } from '../schemas/session.schema';
import { Round } from '../schemas/round.schema';
import { HttpException } from '@nestjs/common';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Session.name) private sessionModel: Model<Session>,
    @InjectModel(Round.name) private roundModel: Model<Round>,
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
}
