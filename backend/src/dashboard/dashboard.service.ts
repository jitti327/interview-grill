import { Injectable, HttpException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  async overview(userId: string) {
    const total = await this.prisma.session.count({ where: { user_id: userId } });
    const completed = await this.prisma.session.count({ where: { user_id: userId, status: 'completed' } });
    const completedSessions = await this.prisma.session.findMany({
      where: { user_id: userId, status: 'completed', avg_score: { not: null } },
      select: { avg_score: true },
    });
    const overallAvg = completedSessions.length
      ? Math.round(
          (completedSessions.reduce((a, s) => a + (s.avg_score || 0), 0) / completedSessions.length) * 10,
        ) / 10
      : 0;
    const recent = await this.prisma.session.findMany({
      where: { user_id: userId, status: 'completed' },
      orderBy: { completed_at: 'desc' },
      take: 10,
    });
    const bestScore = completedSessions.length
      ? Math.round(Math.max(...completedSessions.map((s) => s.avg_score || 0)) * 10) / 10
      : 0;
    const firstScore = completedSessions.length ? completedSessions[0].avg_score || 0 : 0;
    const latestScore = completedSessions.length
      ? completedSessions[completedSessions.length - 1].avg_score || 0
      : 0;
    const improvementDelta = Math.round((latestScore - firstScore) * 10) / 10;

    const leaderboardRows = await this.prisma.$queryRaw<
      Array<{ user_id: string; avg_score: number; rank: number; total_users: number }>
    >`
      WITH ranked AS (
        SELECT user_id,
               AVG(avg_score)::float AS avg_score,
               RANK() OVER (ORDER BY AVG(avg_score) DESC) AS rank,
               COUNT(*) OVER ()::int AS total_users
        FROM "Session"
        WHERE status = 'completed' AND avg_score IS NOT NULL AND user_id IS NOT NULL
        GROUP BY user_id
      )
      SELECT user_id, avg_score, rank::int AS rank, total_users
      FROM ranked
      WHERE user_id = ${userId}
      LIMIT 1
    `;

    const leaderboard = leaderboardRows[0];
    const userRank = leaderboard?.rank || null;
    const totalRankedUsers = leaderboard?.total_users || 0;
    const percentile =
      userRank && totalRankedUsers
        ? Math.round(((totalRankedUsers - userRank + 1) / totalRankedUsers) * 100)
        : null;

    return {
      total_sessions: total,
      completed_sessions: completed,
      overall_avg_score: overallAvg,
      best_score: bestScore,
      improvement_delta: improvementDelta,
      ranked_users: totalRankedUsers,
      user_rank: userRank,
      percentile,
      recent_sessions: recent.map((s) => ({
        ...s,
        created_at: s.created_at?.toISOString?.() ?? s.created_at,
        completed_at: s.completed_at?.toISOString?.() ?? s.completed_at,
      })),
    };
  }

  async skillRadar(userId: string) {
    const sessions = await this.prisma.session.findMany({
      where: { user_id: userId, status: 'completed', avg_score: { not: null } },
      select: { category: true, avg_score: true },
    });
    const byCat: Record<string, { sum: number; count: number }> = {};
    for (const s of sessions) {
      const c = s.category || 'unknown';
      if (!byCat[c]) byCat[c] = { sum: 0, count: 0 };
      byCat[c].sum += s.avg_score || 0;
      byCat[c].count += 1;
    }
    return Object.entries(byCat).map(([category, v]) => ({
      category,
      avg_score: Math.round((v.sum / v.count) * 10) / 10,
      sessions: v.count,
    }));
  }

  async trend(userId: string) {
    const rows = await this.prisma.session.findMany({
      where: { user_id: userId, status: 'completed', avg_score: { not: null } },
      select: {
        id: true,
        avg_score: true,
        category: true,
        tech_stack: true,
        difficulty: true,
        completed_at: true,
      },
      orderBy: { completed_at: 'asc' },
      take: 50,
    });
    return rows.map((r) => ({
      ...r,
      completed_at: r.completed_at?.toISOString?.() ?? r.completed_at,
    }));
  }

  async categoryStats(userId: string) {
    const sessions = await this.prisma.session.findMany({
      where: { user_id: userId, status: 'completed', avg_score: { not: null } },
      select: { category: true, difficulty: true, avg_score: true },
    });
    const map: Record<string, { sum: number; count: number }> = {};
    for (const s of sessions) {
      const key = `${s.category}|${s.difficulty}`;
      if (!map[key]) map[key] = { sum: 0, count: 0 };
      map[key].sum += s.avg_score || 0;
      map[key].count += 1;
    }
    return Object.entries(map).map(([k, v]) => {
      const [category, difficulty] = k.split('|');
      return {
        category,
        difficulty,
        avg_score: Math.round((v.sum / v.count) * 10) / 10,
        sessions: v.count,
      };
    });
  }

  async weakTopics(userId: string) {
    const sessions = await this.prisma.session.findMany({
      where: { user_id: userId },
      select: { id: true },
    });
    const sessionIds = sessions.map((s) => s.id);
    if (!sessionIds.length) return [];

    const rounds = await this.prisma.round.findMany({
      where: {
        session_id: { in: sessionIds },
        score: { not: null },
      },
      select: { topic: true, score: true },
    });
    const byTopic: Record<string, { sum: number; count: number }> = {};
    for (const r of rounds) {
      const t = r.topic || 'unknown';
      if (!byTopic[t]) byTopic[t] = { sum: 0, count: 0 };
      byTopic[t].sum += r.score || 0;
      byTopic[t].count += 1;
    }
    return Object.entries(byTopic)
      .map(([topic, v]) => ({
        topic,
        avg_score: Math.round((v.sum / v.count) * 10) / 10,
        attempts: v.count,
      }))
      .sort((a, b) => a.avg_score - b.avg_score)
      .slice(0, 15);
  }

  async comparison(session1Id: string, session2Id: string, userId: string) {
    const s1 = await this.prisma.session.findFirst({
      where: { id: session1Id, user_id: userId },
    });
    const s2 = await this.prisma.session.findFirst({
      where: { id: session2Id, user_id: userId },
    });
    if (!s1 || !s2) throw new HttpException('One or both sessions not found', 404);

    const r1 = await this.prisma.round.findMany({
      where: { session_id: session1Id, score: { not: null } },
      orderBy: { round_order: 'asc' },
    });
    const r2 = await this.prisma.round.findMany({
      where: { session_id: session2Id, score: { not: null } },
      orderBy: { round_order: 'asc' },
    });

    const scoreA = s1.avg_score || 0;
    const scoreB = s2.avg_score || 0;
    const winner = scoreA > scoreB ? 'a' : scoreB > scoreA ? 'b' : 'tie';

    const mapRound = (r: any) => ({ ...r, order: r.round_order });

    return {
      session_a: { ...s1, created_at: s1.created_at?.toISOString(), completed_at: s1.completed_at?.toISOString() },
      session_b: { ...s2, created_at: s2.created_at?.toISOString(), completed_at: s2.completed_at?.toISOString() },
      rounds_a: r1.map(mapRound),
      rounds_b: r2.map(mapRound),
      winner,
    };
  }

  async leaderboard(limit = 20): Promise<any[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const rows = await this.prisma.$queryRaw<
      Array<{
        user_id: string;
        avg_score: number;
        total_sessions: number;
        best_score: number;
      }>
    >`
      SELECT user_id,
             AVG(avg_score)::float AS avg_score,
             COUNT(*)::int AS total_sessions,
             MAX(avg_score)::float AS best_score
      FROM "Session"
      WHERE status = 'completed' AND avg_score IS NOT NULL AND user_id IS NOT NULL
      GROUP BY user_id
      ORDER BY AVG(avg_score) DESC
      LIMIT ${safeLimit}
    `;

    const enriched = await Promise.all(
      rows.map(async (r, idx) => {
        let userName = 'Anonymous';
        try {
          const user = await this.prisma.user.findUnique({ where: { id: r.user_id } });
          if (user) userName = user.name || user.email;
        } catch {}
        const categories = await this.prisma.session.findMany({
          where: { user_id: r.user_id, status: 'completed' },
          select: { category: true },
          distinct: ['category'],
        });
        return {
          rank: idx + 1,
          user_name: userName,
          avg_score: Math.round(r.avg_score * 10) / 10,
          total_sessions: r.total_sessions,
          best_score: Math.round(r.best_score * 10) / 10,
          categories: categories.map((c) => c.category),
        };
      }),
    );
    return enriched;
  }

  async studyPlan(userId: string): Promise<any> {
    const sessions = await this.prisma.session.findMany({
      where: { user_id: userId },
      select: { id: true },
    });
    const sessionIds = sessions.map((s) => s.id);
    if (!sessionIds.length) {
      return {
        weak_topics: [],
        strong_topics: [],
        plan: 'Complete a few interviews first to generate a personalized study plan.',
        ai_generated: false,
      };
    }

    const rounds = await this.prisma.round.findMany({
      where: {
        session_id: { in: sessionIds },
        score: { not: null },
      },
      select: { topic: true, score: true },
    });

    const byTopic: Record<string, { sum: number; count: number }> = {};
    for (const r of rounds) {
      const t = r.topic || 'unknown';
      if (!byTopic[t]) byTopic[t] = { sum: 0, count: 0 };
      byTopic[t].sum += r.score || 0;
      byTopic[t].count += 1;
    }
    const topicList = Object.entries(byTopic).map(([topic, v]) => ({
      topic,
      avg_score: Math.round((v.sum / v.count) * 10) / 10,
      count: v.count,
    }));
    const weakTopics = [...topicList].sort((a, b) => a.avg_score - b.avg_score).slice(0, 10);
    const strongTopics = [...topicList].sort((a, b) => b.avg_score - a.avg_score).slice(0, 5);

    const totalSessions = await this.prisma.session.count({
      where: { user_id: userId, status: 'completed' },
    });

    const weakList = weakTopics.map((t) => `${t.topic} (avg: ${t.avg_score}/10, ${t.count} attempts)`).join(', ');
    const strongList = strongTopics.map((t) => `${t.topic} (avg: ${t.avg_score}/10)`).join(', ');

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
        weak_topics: weakTopics,
        strong_topics: strongTopics,
        plan,
        ai_generated: true,
      };
    } catch {
      return {
        weak_topics: weakTopics,
        strong_topics: strongTopics,
        plan: {
          priority_topics: weakTopics.slice(0, 5).map((t) => t.topic),
          tips: ['Focus on your weakest areas first', 'Practice daily for consistency', 'Review strong topics to maintain them'],
        },
        ai_generated: false,
      };
    }
  }
}
