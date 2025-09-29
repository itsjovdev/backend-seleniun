//C:\Users\jov\Documents\proyectos\seleniun\backend\api\src\ai\ai.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class AiService {
  private readonly apiKey = process.env.DEEPSEEK_API_KEY!;
  private readonly model  = process.env.LLM_MODEL || 'deepseek-chat';

  async generate(prompt: string, system?: string, temperature = 0.7) {
    const body = {
      model: this.model,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: prompt },
      ],
      stream: false,
      temperature,
    };

    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`DeepSeek error ${res.status}: ${err}`);
    }

    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content ?? '';
    return { text, raw: json };
  }
}
