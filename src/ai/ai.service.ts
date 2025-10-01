import { Injectable } from '@nestjs/common';
import { PassThrough } from 'stream';

@Injectable()
export class AiService {
  private readonly apiKey = process.env.DEEPSEEK_API_KEY!;
  private readonly model  = process.env.LLM_MODEL || 'deepseek-chat';

  // Respuesta "entera" (como ya tenías), pero con max_tokens para que tarde menos
  async generate(prompt: string, system?: string, temperature = 0.7, maxTokens = 700) {
    const body = {
      model: this.model,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: prompt },
      ],
      stream: false,
      temperature,
      max_tokens: maxTokens,
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

  // 🔥 Streaming: devuelve un stream con el texto a medida que llega
  async streamGenerate(prompt: string, system?: string, temperature = 0.7, maxTokens = 700) {
    const body = {
      model: this.model,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: prompt },
      ],
      stream: true,          // <— clave
      temperature,
      max_tokens: maxTokens, // limita longitud → menos tiempo
    };

    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok || !res.body) {
      const err = await res.text().catch(() => '');
      throw new Error(`DeepSeek stream error ${res.status}: ${err}`);
    }

    const out = new PassThrough();
    const reader: ReadableStreamDefaultReader<Uint8Array> = (res.body as any).getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    (async () => {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // El stream viene como SSE: líneas "data: {...}"
        let idx: number;
        while ((idx = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line.startsWith('data:')) continue;

          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') {
            out.end();
            return;
          }

          try {
            const json = JSON.parse(payload);
            const delta = json?.choices?.[0]?.delta?.content ?? '';
            if (delta) out.write(delta);
          } catch {
            // ignora fragmentos incompletos
          }
        }
      }
      out.end();
    })().catch((e) => {
      out.emit('error', e);
      out.end();
    });

    return out; // Node stream con el texto
  }
}
