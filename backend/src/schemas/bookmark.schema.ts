import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({
  collection: 'bookmarks',
  toJSON: { transform: (_, ret) => { delete ret._id; delete ret.__v; return ret; } },
})
export class Bookmark extends Document {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ default: null })
  user_id: string;

  @Prop({ required: true })
  session_id: string;

  @Prop({ required: true })
  round_id: string;

  @Prop({ default: '' })
  question: string;

  @Prop({ default: '' })
  topic: string;

  @Prop({ default: '' })
  question_type: string;

  @Prop({ default: () => new Date().toISOString() })
  created_at: string;
}

export const BookmarkSchema = SchemaFactory.createForClass(Bookmark);
