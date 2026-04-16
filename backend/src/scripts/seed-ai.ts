import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { QuestionsService } from '../questions/questions.service';
import { AiService } from '../ai/ai.service';
import { v4 as uuidv4 } from 'uuid';

const CATEGORY_STACKS = [
  "React", "Angular", "Vue", "Ember",
  "Node.js", "Java", ".NET", "Python",
  "MERN Stack", "MEAN Stack", "Django + React", "Spring + Angular",
  "Distributed Systems", "Scalability", "Microservices", "Database Design",
  "Arrays & Strings", "Trees & Graphs", "Dynamic Programming", "Sorting & Searching"
];

async function seedAI() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const questionsService = app.get(QuestionsService);
  const aiService = app.get(AiService);

  console.log('Starting AI Seeding process...');

  for (const stack of CATEGORY_STACKS) {
    console.log(`\nGenerating 20 questions for stack: ${stack}...`);
    const prompt = `Generate exactly 20 diverse technical interview questions for the following technology/topic: "${stack}".
Include a mix of difficulties (beginner, intermediate, advanced) and question_types (conceptual, coding, scenario).
Respond ONLY with a valid JSON array of objects matching this exact structure:
[
  {
    "difficulty": "beginner|intermediate|advanced",
    "question_type": "conceptual|coding|scenario",
    "category": "core concepts",
    "topic": "specific topic",
    "question": "The interview question text",
    "expected_key_points": ["point 1", "point 2"],
    "hint": "A short hint"
  }
]
Return purely the JSON array without backticks or markdown formatting.`;

    try {
      const response = await aiService.generate(prompt, 'Generate the array of 20 questions now.');
      const parsedArray = aiService.parseJson(response);

      if (Array.isArray(parsedArray)) {
        let count = 0;
        for (const item of parsedArray) {
          await questionsService.createQuestion({
            id: uuidv4(),
            tech_stack: stack,
            difficulty: item.difficulty || 'intermediate',
            question_type: item.question_type || 'conceptual',
            category: item.category || 'general',
            topic: item.topic || 'general',
            question: item.question || 'Explain a core concept',
            expected_key_points: item.expected_key_points || [],
            hint: item.hint || '',
            sample_answer: [],
            tags: [stack.toLowerCase()],
            is_active: true
          });
          count++;
        }
        console.log(`✅ Inserted ${count} questions for ${stack}`);
      } else {
        console.error(`❌ Failed to parse array for ${stack}:`, response.slice(0, 100));
      }
    } catch (err) {
      console.error(`❌ Error generating/inserting for ${stack}:`, err.message);
    }
    
    // API Quota Fix: Delay for 8 seconds before next category to avoid 429 Too Many Requests
    console.log(`Waiting 8 seconds to prevent API Quota limit...`);
    await new Promise(resolve => setTimeout(resolve, 8000));
  }

  console.log('\nAI Seeding complete!');
  await app.close();
}

seedAI();
