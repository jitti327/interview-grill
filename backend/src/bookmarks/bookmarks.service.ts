import { Injectable, HttpException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Bookmark } from '../schemas/bookmark.schema';
import { Round } from '../schemas/round.schema';

@Injectable()
export class BookmarksService {
  constructor(
    @InjectModel(Bookmark.name) private bookmarkModel: Model<Bookmark>,
    @InjectModel(Round.name) private roundModel: Model<Round>,
  ) {}

  async create(sessionId: string, roundId: string, userId?: string) {
    const round = await this.roundModel.findOne({ id: roundId }).lean();
    if (!round) throw new HttpException('Round not found', 404);

    const bookmark = {
      id: uuidv4(),
      user_id: userId || null,
      session_id: sessionId,
      round_id: roundId,
      question: round.question || '',
      topic: round.topic || '',
      question_type: round.question_type || '',
      created_at: new Date().toISOString(),
    };
    await this.bookmarkModel.create(bookmark);
    return bookmark;
  }

  async list(userId?: string) {
    const query: any = userId ? { user_id: userId } : {};
    return this.bookmarkModel.find(query, { _id: 0, __v: 0 }).sort({ created_at: -1 }).limit(100).lean();
  }

  async remove(bookmarkId: string) {
    const result = await this.bookmarkModel.deleteOne({ id: bookmarkId });
    if (result.deletedCount === 0) throw new HttpException('Bookmark not found', 404);
    return { message: 'Bookmark deleted' };
  }
}
