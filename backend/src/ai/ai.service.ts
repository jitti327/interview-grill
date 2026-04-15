import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class AiService {
  private genAI: GoogleGenerativeAI;
  private models = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'];

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }

  async generate(systemPrompt: string, userText: string): Promise<string> {
    let lastError: Error;
    for (const modelName of this.models) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const model = this.genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: systemPrompt,
          });
          const result = await model.generateContent(userText);
          return result.response.text();
        } catch (error) {
          lastError = error;
          console.warn(`AI call failed (model=${modelName}, attempt=${attempt + 1}): ${error.message}`);
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        }
      }
      console.log(`Model ${modelName} exhausted retries, trying next...`);
    }
    throw lastError || new Error('All AI models failed');
  }

  parseJson(text: string): any {
    let cleaned = text.trim();
    const codeBlock = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlock) cleaned = codeBlock[1];
    try {
      return JSON.parse(cleaned.trim());
    } catch {
      const obj = cleaned.match(/\{[\s\S]*\}/);
      if (obj) return JSON.parse(obj[0]);
      throw new Error('Could not parse AI JSON response');
    }
  }
}
