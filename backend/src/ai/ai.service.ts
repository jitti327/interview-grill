import { Injectable } from '@nestjs/common';

@Injectable()
export class AiService {
  private readonly openRouterApiKey: string;
  private readonly defaultModels: string[];

  constructor() {
    this.openRouterApiKey = (process.env.OPENROUTER_API_KEY || '').trim();
    this.defaultModels = this.resolveDefaultModels();
  }

  private parseModelsCsv(value?: string): string[] {
    return String(value || '')
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);
  }

  private resolveDefaultModels(): string[] {
    const generic = this.parseModelsCsv(process.env.AI_MODELS);
    if (generic.length) return generic;
    const openRouterModels = this.parseModelsCsv(process.env.OPENROUTER_MODELS || process.env.OPENROUTER_MODEL);
    if (openRouterModels.length) return openRouterModels;
    return ['meta-llama/llama-3.3-70b-instruct:free', 'qwen/qwen3-coder:free'];
  }

  isConfigured(): boolean {
    return Boolean(this.openRouterApiKey);
  }

  private async generateWithOpenRouter(
    systemPrompt: string,
    userText: string,
    modelName: string,
  ): Promise<string> {
    if (!this.openRouterApiKey) {
      throw new Error('OpenRouter API key is not configured');
    }
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.openRouterApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userText },
        ],
        temperature: 0.2,
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenRouter error ${response.status}: ${body}`);
    }
    const data: any = await response.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text || typeof text !== 'string') {
      throw new Error('OpenRouter response did not contain text content');
    }
    return text;
  }

  async generate(
    systemPrompt: string,
    userText: string,
    preferredModels?: string[],
    options?: { maxRetriesPerModel?: number; retryBackoffMs?: number; failFastOnRateLimit?: boolean },
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('OpenRouter API key is not configured');
    }
    const requestedModels = preferredModels?.length ? preferredModels : this.defaultModels;
    const looksLikeGeminiOnly = requestedModels.every((m) => /^gemini[-\w.]*$/i.test(m));
    const modelOrder = looksLikeGeminiOnly ? this.defaultModels : requestedModels;
    const maxRetriesPerModel = Math.max(1, options?.maxRetriesPerModel ?? 3);
    const retryBackoffMs = Math.max(100, options?.retryBackoffMs ?? 1500);
    let lastError: Error;
    for (const modelName of modelOrder) {
      for (let attempt = 0; attempt < maxRetriesPerModel; attempt++) {
        try {
          return await this.generateWithOpenRouter(systemPrompt, userText, modelName);
        } catch (error: any) {
          lastError = error;
          const message = String(error?.message || '');
          const isRateLimit = /\b429\b|quota|rate[-\s]?limit|too many requests/i.test(message);
          const isEndpointUnavailable = /\b404\b|no endpoints found|model.*not found/i.test(message);
          console.warn(`AI call failed (provider=openrouter, model=${modelName}, attempt=${attempt + 1}): ${message}`);
          if (isEndpointUnavailable) {
            break;
          }
          if (isRateLimit && options?.failFastOnRateLimit) {
            break;
          }
          if (isRateLimit && !options?.failFastOnRateLimit) {
            break;
          }
          if (attempt < maxRetriesPerModel - 1) {
            await new Promise((r) => setTimeout(r, retryBackoffMs * (attempt + 1)));
          }
        }
      }
      console.log(`Provider openrouter: model ${modelName} exhausted retries, trying next...`);
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
