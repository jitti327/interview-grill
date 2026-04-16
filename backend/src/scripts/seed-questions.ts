import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { QuestionsService } from '../questions/questions.service';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

async function seedQuestions() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const questionsService = app.get(QuestionsService);
  const connection = app.get<Connection>(getConnectionToken());

  try {
    const c: any = connection;
    console.log(
      `Mongo connected: db=${c?.name || '<unknown>'} host=${c?.host || '<unknown>'}:${c?.port || '<unknown>'}`,
    );
    console.log('Seeding questions (20 per stack)...');
    await questionsService.seedQuestions();
    console.log('Questions seeded successfully');
  } catch (error) {
    console.error('Error seeding questions:', error);
  } finally {
    await app.close();
  }
}

seedQuestions();
