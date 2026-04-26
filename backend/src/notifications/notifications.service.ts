import { Injectable, HttpException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, type: string, title: string, message: string, metadata: any = {}): Promise<any> {
    const notif = await this.prisma.notification.create({
      data: {
        user_id: userId,
        type,
        title,
        message,
        metadata: metadata || {},
      },
    });
    return notif;
  }

  async list(userId: string, unreadOnly = false): Promise<any[]> {
    const where: any = { user_id: userId };
    if (unreadOnly) where.read = false;
    return this.prisma.notification.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 50,
    });
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { user_id: userId, read: false } });
  }

  async markRead(notifId: string, userId: string): Promise<any> {
    const result = await this.prisma.notification.updateMany({
      where: { id: notifId, user_id: userId },
      data: { read: true },
    });
    if (result.count === 0) throw new HttpException('Notification not found', 404);
    return { message: 'Marked as read' };
  }

  async markAllRead(userId: string): Promise<any> {
    await this.prisma.notification.updateMany({
      where: { user_id: userId, read: false },
      data: { read: true },
    });
    return { message: 'All marked as read' };
  }

  async onSessionComplete(userId: string, session: any): Promise<void> {
    if (!userId) return;
    await this.create(
      userId,
      'session_complete',
      'Interview Complete',
      `You scored ${session.avg_score || 0}/10 in ${session.tech_stack} (${session.difficulty})`,
      { session_id: session.id, score: session.avg_score },
    );

    const totalCompleted = await this.prisma.session.count({
      where: { user_id: userId, status: 'completed' },
    });
    const milestones = [5, 10, 25, 50, 100];
    if (milestones.includes(totalCompleted)) {
      await this.create(
        userId,
        'achievement',
        `${totalCompleted} Interviews Completed!`,
        `You've reached ${totalCompleted} completed interviews. Keep grinding!`,
        { milestone: totalCompleted },
      );
    }
  }

  async generateWeeklySummary(userId: string): Promise<any> {
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const sessions = await this.prisma.session.findMany({
      where: { user_id: userId, status: 'completed', completed_at: { gte: weekAgo } },
    });

    const totalSessions = sessions.length;
    if (totalSessions === 0) {
      return { sessions: 0, message: 'No interviews completed this week. Start practicing!' };
    }

    const avgScore =
      Math.round((sessions.reduce((a, s) => a + (s.avg_score || 0), 0) / totalSessions) * 10) / 10;
    const bestSession = sessions.reduce(
      (best, s) => ((s.avg_score || 0) > (best.avg_score || 0) ? s : best),
      sessions[0],
    );
    const categories = [...new Set(sessions.map((s) => s.category))];

    const rounds = await this.prisma.round.findMany({
      where: { session_id: { in: sessions.map((s) => s.id) }, score: { not: null } },
      select: { topic: true, score: true },
    });

    const topicScores: Record<string, { total: number; count: number }> = {};
    for (const r of rounds) {
      if (!r.topic) continue;
      if (!topicScores[r.topic]) topicScores[r.topic] = { total: 0, count: 0 };
      topicScores[r.topic].total += r.score || 0;
      topicScores[r.topic].count++;
    }
    const weakTopics = Object.entries(topicScores)
      .map(([t, v]) => ({ topic: t, avg: Math.round((v.total / v.count) * 10) / 10 }))
      .sort((a, b) => a.avg - b.avg)
      .slice(0, 3);

    const summary = {
      sessions: totalSessions,
      avg_score: avgScore,
      best_score: bestSession.avg_score,
      best_stack: bestSession.tech_stack,
      categories,
      weak_topics: weakTopics,
      message: `This week: ${totalSessions} interviews, avg score ${avgScore}/10. ${
        weakTopics.length ? `Focus on: ${weakTopics.map((t) => t.topic).join(', ')}` : 'Keep it up!'
      }`,
    };

    await this.create(userId, 'weekly_summary', 'Weekly Performance Summary', summary.message, summary);
    return summary;
  }
}
