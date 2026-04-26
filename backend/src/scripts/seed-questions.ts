import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { QuestionsService } from '../questions/questions.service';

async function seedQuestions() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const questionsService = app.get(QuestionsService);

  try {
    console.log('Seeding expanded question bank for all stacks...');
    await questionsService.seedQuestions();
    console.log('Questions seeded successfully');
  } catch (error) {
    console.error('Error seeding questions:', error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

seedQuestions();
