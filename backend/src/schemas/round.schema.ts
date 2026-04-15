import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({
  collection: 'rounds',
  toJSON: { transform: (_, ret) => { delete ret._id; delete ret.__v; return ret; } },
})
export class Round extends Document {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true })
  session_id: string;

  @Prop({ required: true })
  order: number;

  @Prop({ default: '' })
  question: string;

  @Prop({ default: 'conceptual' })
  question_type: string;

  @Prop({ default: 'general' })
  topic: string;

  @Prop({ type: [String], default: [] })
  expected_key_points: string[];

  @Prop({ default: '' })
  hint: string;

  @Prop({ default: null })
  answer: string;

  @Prop({ default: null })
  score: number;

  @Prop({ default: null })
  feedback: string;

  @Prop({ type: [String], default: [] })
  strengths: string[];

  @Prop({ type: [String], default: [] })
  weaknesses: string[];

  @Prop({ default: null })
  follow_up_question: string;

  @Prop({ type: [String], default: [] })
  improvement_suggestions: string[];

  @Prop({ default: null })
  verdict: string;

  @Prop({ default: () => new Date().toISOString() })
  created_at: string;
}

export const RoundSchema = SchemaFactory.createForClass(Round);
