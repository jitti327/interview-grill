import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class AiService {
  private genAI: GoogleGenerativeAI;
  private models = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'];
  private readonly apiKey: string;

  constructor() {
    this.apiKey = this.resolveApiKey();
    this.genAI = new GoogleGenerativeAI(this.apiKey);
  }

  private resolveApiKey(): string {
    return (
      process.env.GEMINI_API_KEY?.trim() ||
      process.env.GOOGLE_API_KEY?.trim() ||
      process.env.GOOGLE_GEMINI_API_KEY?.trim() ||
      ''
    );
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async generate(
    systemPrompt: string,
    userText: string,
    preferredModels?: string[],
    options?: { maxRetriesPerModel?: number; retryBackoffMs?: number; failFastOnRateLimit?: boolean },
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Gemini API key is not configured');
    }
    const modelOrder = preferredModels?.length ? preferredModels : this.models;
    const maxRetriesPerModel = Math.max(1, options?.maxRetriesPerModel ?? 3);
    const retryBackoffMs = Math.max(100, options?.retryBackoffMs ?? 1500);
    let lastError: Error;
    for (const modelName of modelOrder) {
      for (let attempt = 0; attempt < maxRetriesPerModel; attempt++) {
        try {
          const model = this.genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: systemPrompt,
          });
          const result = await model.generateContent(userText);
          return result.response.text();
        } catch (error: any) {
          lastError = error;
          const message = String(error?.message || '');
          const isRateLimit = /\b429\b|quota|rate[-\s]?limit/i.test(message);
          console.warn(`AI call failed (model=${modelName}, attempt=${attempt + 1}): ${message}`);
          if (isRateLimit && options?.failFastOnRateLimit) {
            break;
          }
          if (attempt < maxRetriesPerModel - 1) {
            await new Promise((r) => setTimeout(r, retryBackoffMs * (attempt + 1)));
          }
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
