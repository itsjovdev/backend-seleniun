import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export type SummarizeMode = 'executive' | 'rich';
export type ReturnFormat = 'markdown' | 'json+markdown';

export interface SummarizeOptions {
  mode?: SummarizeMode;
  targetWordsPerChunk?: number;
  chunkOverlapSentences?: number;
  returnFormat?: ReturnFormat;
}

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  // —— LÍMITES —
  private MAX_PAGES = Number(process.env.MAX_PAGES || 15);
  private MAX_PDF_MB = Number(process.env.MAX_PDF_MB || 10);
  private REQUEST_TIMEOUT_MS = 60_000;

  // —— PROVEEDOR —
  private PROVIDER = (process.env.LLM_PROVIDER || 'deepseek').toLowerCase(); // 'deepseek' | 'cohere'
  private LLM_MODEL =
    process.env.LLM_MODEL || (this.PROVIDER === 'deepseek' ? 'deepseek-chat' : 'command-light');
  private DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
  private COHERE_API_KEY = process.env.COHERE_API_KEY || '';

  // Número de páginas del PDF en curso (para anotaciones)
  private lastPdfPages = 0;

  // -------------------------- HELPERS OFFLINE (COMPLETOS) --------------------------

  /** Análisis rápido del texto para fallback offline */
  private analyzeText(text: string): {
    totalSentences: number;
    totalWords: number;
    totalParagraphs: number;
    importantSentences: string[];
    keyPoints: string[];
  } {
    const sentences = text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 5);

    const words = text.split(/\s+/).filter((w) => w.length > 0);

    const paragraphs = text
      .split(/\n\s*\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 10);

    const importantSentences = sentences
      .filter((s) => s.length > 40 && s.length < 240)
      .map((s) => ({ text: s, score: this.calculateImportance(s) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((i) => i.text);

    const keyPoints = paragraphs
      .slice(0, 20)
      .map((p) => {
        const first = p.split(/(?<=[.!?])\s+/)[0];
        return first && first.length > 20 ? first.trim() : null;
      })
      .filter((x): x is string => Boolean(x))
      .slice(0, 10);

    return {
      totalSentences: sentences.length,
      totalWords: words.length,
      totalParagraphs: paragraphs.length,
      importantSentences,
      keyPoints,
    };
  }

  /** Heurística simple para ordenar frases por importancia */
  private calculateImportance(sentence: string): number {
    const kw = [
      'importante',
      'principal',
      'conclus',
      'resultado',
      'objetivo',
      'propósito',
      'meta',
      'fundamental',
      'esencial',
      'clave',
      'relevante',
      'crítico',
      'vital',
      'procedimiento',
      'paso',
      'instalar',
      'configurar',
    ];
    let score = Math.min(sentence.length, 240) * 0.12;
    const low = sentence.toLowerCase();
    kw.forEach((k) => {
      if (low.includes(k)) score += 8;
    });
    if (/\d+/.test(sentence)) score += 4;
    if (/(por ejemplo|es decir|además|nota:)/i.test(sentence)) score += 1;
    return score;
  }

  private extractBulletsStepsCommands(text: string) {
    const lines = text.split('\n').map((l) => l.trim());
    const bullets = lines.filter((l) => /^(\*|-|•|\u2022)\s+/.test(l)).slice(0, 60);
    const steps = lines.filter((l) => /^(\d+[\.\)]\s+)/.test(l)).slice(0, 80);
    const hashParams = Array.from(text.matchAll(/#[A-Za-z_]+(?:=[^ \n&#]+)?/g)).map((m) => m[0]);
    const urls = Array.from(text.matchAll(/\bhttps?:\/\/[^\s)]+/g)).map((m) => m[0]);
    return { bullets, steps, commands: [...new Set(hashParams)], urls: [...new Set(urls)] };
  }

  private generateOfflineExecutive(text: string, a: ReturnType<typeof this.analyzeText>): string {
    const { importantSentences, keyPoints, totalWords, totalParagraphs } = a;
    return `# Resumen ejecutivo (offline)

**Extensión aproximada:** ${Math.max(1, Math.ceil(totalWords / 250))} páginas  
**Párrafos analizados:** ${totalParagraphs}

## Puntos clave
${keyPoints.slice(0, 8).map((p) => `- ${p}`).join('\n')}

## Frases relevantes
${importantSentences.slice(0, 6).map((s) => `- ${s}`).join('\n')}

> Generado por análisis local sin IA externa. Puede omitir matices.`;
  }

  private generateOfflineRich(text: string, a: ReturnType<typeof this.analyzeText>): string {
    const { importantSentences, keyPoints } = a;
    const x = this.extractBulletsStepsCommands(text);
    return `# Resumen estructurado (offline)

## Contexto
${importantSentences[0] ?? keyPoints[0] ?? 'Documento técnico.'}

## Índice
${keyPoints.map((p) => `- ${p}`).join('\n')}

## Procedimientos detectados
${x.steps.length ? x.steps.slice(0, 30).map((s) => `- ${s}`).join('\n') : '- (No se detectaron pasos numerados con claridad)'}

## Comandos / parámetros
${x.commands.length ? x.commands.map((c) => `- ${c}`).join('\n') : '- (Sin parámetros tipo #page=, #zoom=, etc.)'}

## Puntos destacados
${importantSentences.slice(0, 6).map((s) => `- ${s}`).join('\n')}

## Referencias
${x.urls.length ? x.urls.map((u) => `- ${u}`).join('\n') : '- (Sin URLs encontradas)'}
`;
  }

  // -------------------------- CHUNKING & PROMPTS --------------------------
  private splitIntoChunksWithOverlap(text: string, targetWords = 800, overlapSents = 2): string[] {
    const sents = text.replace(/\s+/g, ' ').split(/(?<=[\.\?\!])\s+/);
    const chunks: string[] = [];
    let cur: string[] = [];
    let count = 0;

    for (let i = 0; i < sents.length; i++) {
      const s = sents[i];
      const w = s.split(/\s+/).length;
      if (count + w > targetWords && cur.length) {
        chunks.push(cur.join(' '));
        // dejar solapamiento de N oraciones
        cur = cur.slice(-overlapSents);
        count = cur.join(' ').split(/\s+/).length;
      }
      cur.push(s);
      count += w;
    }
    if (cur.length) chunks.push(cur.join(' '));
    return chunks;
  }

  private buildPartialPrompt(mode: SummarizeMode, chunkText: string) {
    const base = `
Eres un asistente que **extrae y estructura** contenido.
Tarea: resume **en el mismo idioma en que está escrito el texto**.
Longitud: 120–180 palabras.

Requisitos:
- Mantén viñetas y numeraciones si existen.
- Conserva nombres de herramientas, comandos, rutas y parámetros (por ejemplo, "documento.pdf#page=…").
- No inventes datos. No repitas.
${mode === 'rich' ? `
Si detectas elementos, incluye secciones:
- "Procedimientos" con pasos numerados.
- "Comandos/Parámetros".
- "Herramientas" y para qué sirven.
` : ''}

Texto:
`.trim();

    return `${base}\n\n${chunkText}`;
  }

  private buildReducerPrompt(mode: SummarizeMode, partials: string[], approxPageRanges?: string[]) {
    const head = `
Une y depura los mini-resúmenes en **${mode === 'rich' ? '800–1,200' : '250–500'} palabras**,
siempre **en el mismo idioma que el texto original**.

Estructura obligatoria:
${mode === 'rich' ? `
1) Contexto breve (2–3 líneas)
2) Índice de temas (viñetas)
3) Procedimientos paso a paso (cada uno con pasos numerados)
4) Comandos y parámetros útiles (p. ej., "documento.pdf#page=...", "zoom=", "pagemode=")
5) Herramientas y descargas (qué es y para qué sirve)
6) Buenas prácticas / notas
7) Checklist final
8) Glosario (términos clave)
` : `
1) Contexto
2) Puntos clave (viñetas)
3) Conclusión
`}
Si indico rangos de páginas, puedes citarlos como (≈p. X–Y).

Responde en **Markdown** limpio.
`.trim();

    const body = partials
      .map((p, i) => {
        const tag = approxPageRanges?.[i] ? ` (≈${approxPageRanges[i]})` : '';
        return `[#${i + 1}${tag}] ${p}`;
      })
      .join('\n\n');

    return `${head}\n\n${body}`;
  }

  // -------------------------- ADAPTADOR LLM --------------------------
  private async callLLM(prompt: string, maxOutTokens = 800, temperature = 0.2): Promise<string> {
    if (this.PROVIDER === 'deepseek') {
      return this.callDeepSeek(prompt, maxOutTokens, temperature);
    }
    if (this.PROVIDER === 'cohere') {
      return this.callCohere(prompt, maxOutTokens, temperature);
    }
    throw new Error(`Proveedor LLM no soportado: ${this.PROVIDER}`);
  }

  // DeepSeek: API “chat completions”
  private async callDeepSeek(prompt: string, maxOutTokens = 800, temperature = 0.2): Promise<string> {
    if (!this.DEEPSEEK_API_KEY) throw new Error('Falta DEEPSEEK_API_KEY');

    const url = 'https://api.deepseek.com/v1/chat/completions';
    const body = {
      model: this.LLM_MODEL || 'deepseek-chat',
      messages: [
        { role: 'system', content: 'Eres un asistente experto en resumen de documentos. Mantén el idioma original.' },
        { role: 'user', content: prompt },
      ],
      temperature,
      max_tokens: maxOutTokens,
      stream: false,
    };

    const { data } = await axios.post(url, body, {
      timeout: this.REQUEST_TIMEOUT_MS,
      headers: {
        Authorization: `Bearer ${this.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const text = data?.choices?.[0]?.message?.content ?? '';
    if (!text) throw new Error('DeepSeek devolvió respuesta vacía');
    return String(text).trim();
  }

  // Cohere (listo para que cambies a variables y ya)
  private async callCohere(prompt: string, maxOutTokens = 800, temperature = 0.2): Promise<string> {
    if (!this.COHERE_API_KEY) throw new Error('Falta COHERE_API_KEY');

    const url = 'https://api.cohere.ai/v1/generate';
    const body = {
      model: this.LLM_MODEL || 'command-light',
      prompt,
      max_tokens: maxOutTokens,
      temperature,
      k: 0,
      return_likelihoods: 'NONE',
    };

    const { data } = await axios.post(url, body, {
      timeout: this.REQUEST_TIMEOUT_MS,
      headers: {
        Authorization: `Bearer ${this.COHERE_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const text = data?.generations?.[0]?.text ?? '';
    if (!text) throw new Error('Cohere devolvió respuesta vacía');
    return String(text).trim();
  }

  // -------------------------- ORQUESTA: chunks -> fusión --------------------------
  private async summarizeWithLLM(text: string, opts: SummarizeOptions) {
    const mode: SummarizeMode = opts.mode ?? 'executive';
    const clean = text.replace(/\s+/g, ' ').trim();
    const target = opts.targetWordsPerChunk ?? 800;
    const overlap = opts.chunkOverlapSentences ?? 2;
    const chunks = this.splitIntoChunksWithOverlap(clean, target, overlap);

    // Rango de páginas aproximado (ornamental)
    const approx: string[] = [];
    const pagesPerChunk = Math.max(1, Math.round(this.lastPdfPages / Math.max(1, chunks.length)));
    for (let i = 0; i < chunks.length; i++) {
      const start = i * pagesPerChunk + 1;
      const end = Math.min(this.lastPdfPages, (i + 1) * pagesPerChunk);
      approx.push(`p. ${start}${end > start ? `–${end}` : ''}`);
    }

    // Resumen por bloque
    const partials: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const prompt = this.buildPartialPrompt(mode, chunks[i]);
      const p = await this.callLLM(prompt, 320, 0.2);
      partials.push(p);
    }

    // Reducción/fusión final
    const finalMd = await this.callLLM(this.buildReducerPrompt(mode, partials, approx), 800, 0.2);

    if (opts.returnFormat === 'json+markdown') {
      const jsonPrompt = `
A partir del siguiente Markdown, genera un **JSON puro** con estas claves:
{
  "contexto": string,
  "indice": string[],
  "procedimientos": [{"titulo": string, "pasos": string[]}],
  "comandos": string[],
  "herramientas": [{"nombre": string, "descripcion": string}],
  "buenas_practicas": string[],
  "checklist": string[],
  "glosario": [{"termino": string, "definicion": string}]
}
No incluyas nada fuera del JSON (sin backticks, sin comentarios).
Si falta alguna sección, usa un array vacío.

Texto:
${finalMd}`.trim();

      let parsed: any = null;
      try {
        const raw = await this.callLLM(jsonPrompt, 800, 0.0);
        parsed = JSON.parse(raw);
      } catch {
        // si falla JSON, seguimos solo con Markdown
      }
      return { finalMd, partials, chunks: chunks.length, approxPages: approx, json: parsed };
    }

    return { finalMd, partials, chunks: chunks.length, approxPages: approx };
  }

  // -------------------------- API PÚBLICA --------------------------
  async summarizePdf(buffer: Buffer, opts: SummarizeOptions = {}) {
    const start = Date.now();

    const pdfParse = require('pdf-parse');
    const bytes = buffer.length;
    const mb = bytes / (1024 * 1024);
    if (mb > this.MAX_PDF_MB) {
      throw new Error(`Máximo permitido: ${this.MAX_PDF_MB} MB.`);
    }

    const pdfData = await pdfParse(buffer);
    if (!pdfData || typeof pdfData.text !== 'string') {
      throw new Error('No se pudo procesar el PDF.');
    }
    if (pdfData.numpages > this.MAX_PAGES) {
      throw new Error(`Máximo permitido: ${this.MAX_PAGES} páginas.`);
    }

    const rawText: string = (pdfData.text || '').trim();
    this.lastPdfPages = pdfData.numpages;

    if (!rawText) {
      throw new Error('No se pudo extraer texto (PDF escaneado sin OCR).');
    }

    try {
      this.logger.log(`🧠 Estrategia: ${this.PROVIDER.toUpperCase()} (${this.LLM_MODEL})`);
      const result = await this.summarizeWithLLM(rawText, opts);
      return {
        success: true,
        strategy: this.PROVIDER,
        pages: pdfData.numpages,
        chunks: result.chunks,
        approx_pages_by_chunk: result.approxPages,
        processing_time_seconds: Math.round((Date.now() - start) / 1000),
        summary_markdown: result.finalMd,
        summary_json: (result as any).json ?? null,
        partial_summaries: result.partials,
      };
    } catch (e: any) {
      this.logger.error('❌ LLM falló, usando offline_fallback:', e?.message);

      const analysis = this.analyzeText(rawText);
      const md =
        (opts.mode ?? 'executive') === 'rich'
          ? this.generateOfflineRich(rawText, analysis)
          : this.generateOfflineExecutive(rawText, analysis);

      return {
        success: true,
        strategy: 'offline_fallback',
        pages: pdfData.numpages,
        chunks: 1,
        approx_pages_by_chunk: [`p. 1–${pdfData.numpages}`],
        processing_time_seconds: Math.round((Date.now() - start) / 1000),
        summary_markdown: md,
        summary_json: null,
        partial_summaries: [],
      };
    }
  }
}
