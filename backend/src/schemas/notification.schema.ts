import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({
  collection: 'notifications',
  toJSON: { transform: (_: any, ret: any) => { delete ret._id; delete ret.__v; return ret; } },
})
export class Notification extends Document {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ default: null })
  user_id: string;

  @Prop({ required: true })
  type: string; // 'session_complete' | 'weekly_summary' | 'achievement' | 'study_reminder'

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  message: string;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;

  @Prop({ default: false })
  read: boolean;

  @Prop({ default: () => new Date().toISOString() })
  created_at: string;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
