import { Injectable, HttpException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BookmarksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(sessionId: string, roundId: string, userId: string) {
    const round = await this.prisma.round.findFirst({ where: { id: roundId } });
    if (!round) throw new HttpException('Round not found', 404);

    const bookmark = await this.prisma.bookmark.create({
      data: {
        user_id: userId,
        session_id: sessionId,
        round_id: roundId,
        question: round.question || '',
        topic: round.topic || '',
        question_type: round.question_type || '',
      },
    });
    return bookmark;
  }

  async list(userId: string) {
    return this.prisma.bookmark.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: 100,
    });
  }

  async remove(bookmarkId: string, userId: string) {
    const result = await this.prisma.bookmark.deleteMany({
      where: { id: bookmarkId, user_id: userId },
    });
    if (result.count === 0) throw new HttpException('Bookmark not found', 404);
    return { message: 'Bookmark deleted' };
  }
}
