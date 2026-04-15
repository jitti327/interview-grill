import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({
  collection: 'sessions',
  toJSON: { transform: (_, ret) => { delete ret._id; delete ret.__v; return ret; } },
})
export class Session extends Document {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ default: null })
  user_id: string;

  @Prop({ required: true })
  tech_stack: string;

  @Prop({ required: true })
  category: string;

  @Prop({ required: true })
  difficulty: string;

  @Prop({ default: 8 })
  num_questions: number;

  @Prop({ default: false })
  timed_mode: boolean;

  @Prop({ default: 300 })
  time_per_question: number;

  @Prop({ default: 0 })
  questions_asked: number;

  @Prop({ default: 'active' })
  status: string;

  @Prop({ default: null })
  avg_score: number;

  @Prop({ default: () => new Date().toISOString() })
  created_at: string;

  @Prop({ default: null })
  completed_at: string;
}

export const SessionSchema = SchemaFactory.createForClass(Session);
