import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({
  collection: 'users',
  toJSON: { transform: (_: any, ret: any) => { ret._id = ret._id?.toString(); delete ret.__v; delete ret.password_hash; return ret; } },
})
export class User extends Document {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password_hash: string;

  @Prop({ default: '' })
  name: string;

  @Prop({ default: 'user' })
  role: string;

  @Prop({ default: () => new Date().toISOString() })
  created_at: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
