import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Notification } from '../schemas/notification.schema';
import { Session } from '../schemas/session.schema';
import { Round } from '../schemas/round.schema';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name) private notifModel: Model<Notification>,
    @InjectModel(Session.name) private sessionModel: Model<Session>,
    @InjectModel(Round.name) private roundModel: Model<Round>,
  ) {}

  async create(userId: string, type: string, title: string, message: string, metadata: any = {}): Promise<any> {
    const notif = {
      id: uuidv4(), user_id: userId, type, title, message, metadata,
      read: false, created_at: new Date().toISOString(),
    };
    await this.notifModel.create(notif);
    return notif;
  }

  async list(userId: string, unreadOnly = false): Promise<any[]> {
    const query: any = { user_id: userId };
    if (unreadOnly) query.read = false;
    return this.notifModel.find(query, { _id: 0, __v: 0 }).sort({ created_at: -1 }).limit(50).lean();
  }

  async unreadCount(userId: string): Promise<number> {
    return this.notifModel.countDocuments({ user_id: userId, read: false });
  }

  async markRead(notifId: string): Promise<any> {
    await this.notifModel.updateOne({ id: notifId }, { $set: { read: true } });
    return { message: 'Marked as read' };
  }

  async markAllRead(userId: string): Promise<any> {
    await this.notifModel.updateMany({ user_id: userId, read: false }, { $set: { read: true } });
    return { message: 'All marked as read' };
  }

  async onSessionComplete(userId: string, session: any): Promise<void> {
    if (!userId) return;
    await this.create(userId, 'session_complete',
      'Interview Complete',
      `You scored ${session.avg_score || 0}/10 in ${session.tech_stack} (${session.difficulty})`,
      { session_id: session.id, score: session.avg_score },
    );

    const totalCompleted = await this.sessionModel.countDocuments({ user_id: userId, status: 'completed' });
    const milestones = [5, 10, 25, 50, 100];
    if (milestones.includes(totalCompleted)) {
      await this.create(userId, 'achievement',
        `${totalCompleted} Interviews Completed!`,
        `You've reached ${totalCompleted} completed interviews. Keep grinding!`,
        { milestone: totalCompleted },
      );
    }
  }

  async generateWeeklySummary(userId: string): Promise<any> {
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const sessions = await this.sessionModel.find({
      user_id: userId, status: 'completed', completed_at: { $gte: weekAgo },
    }, { _id: 0, __v: 0 }).lean();

    const totalSessions = sessions.length;
    if (totalSessions === 0) {
      return { sessions: 0, message: 'No interviews completed this week. Start practicing!' };
    }

    const avgScore = Math.round(
      (sessions.reduce((a, s) => a + (s.avg_score || 0), 0) / totalSessions) * 10,
    ) / 10;
    const bestSession = sessions.reduce((best, s) => (s.avg_score || 0) > (best.avg_score || 0) ? s : best, sessions[0]);
    const categories = [...new Set(sessions.map(s => s.category))];

    const rounds = await this.roundModel.find({
      session_id: { $in: sessions.map(s => s.id) }, score: { $ne: null },
    }, { topic: 1, score: 1, _id: 0 }).lean();

    const topicScores: Record<string, { total: number; count: number }> = {};
    for (const r of rounds) {
      if (!r.topic) continue;
      if (!topicScores[r.topic]) topicScores[r.topic] = { total: 0, count: 0 };
      topicScores[r.topic].total += r.score;
      topicScores[r.topic].count++;
    }
    const weakTopics = Object.entries(topicScores)
      .map(([t, v]) => ({ topic: t, avg: Math.round((v.total / v.count) * 10) / 10 }))
      .sort((a, b) => a.avg - b.avg).slice(0, 3);

    const summary = {
      sessions: totalSessions,
      avg_score: avgScore,
      best_score: bestSession.avg_score,
      best_stack: bestSession.tech_stack,
      categories,
      weak_topics: weakTopics,
      message: `This week: ${totalSessions} interviews, avg score ${avgScore}/10. ${weakTopics.length ? `Focus on: ${weakTopics.map(t => t.topic).join(', ')}` : 'Keep it up!'}`,
    };

    await this.create(userId, 'weekly_summary', 'Weekly Performance Summary', summary.message, summary);
    return summary;
  }
}
