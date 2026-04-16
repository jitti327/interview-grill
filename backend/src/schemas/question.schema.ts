import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({
  collection: 'questions',
  toJSON: { transform: (_, ret) => { delete ret._id; delete ret.__v; return ret; } },
})
export class Question extends Document {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true, lowercase: true, trim: true })
  stack: string;

  // Backward-compatible alias for legacy seeded records.
  @Prop()
  tech_stack: string;

  @Prop({ required: true, enum: ['easy', 'medium', 'hard'] })
  difficulty: string;

  @Prop({ required: true, enum: ['conceptual', 'coding', 'scenario', 'behavioral'] })
  question_type: string;

  @Prop({ required: true })
  category: string;

  @Prop({ required: true })
  topic: string;

  @Prop({ required: true })
  question: string;

  @Prop({ type: [String], required: true })
  expected_key_points: string[];

  @Prop()
  hint: string;

  @Prop({ type: [String], default: [] })
  sample_answer: string[];

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ default: true })
  is_active: boolean;

  @Prop({ default: () => new Date().toISOString() })
  created_at: string;

  @Prop({ default: () => new Date().toISOString() })
  updated_at: string;
}

export const QuestionSchema = SchemaFactory.createForClass(Question);
