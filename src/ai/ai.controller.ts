//C:\Users\jov\Documents\proyectos\seleniun\backend\api\src\ai\ai.controller.ts
import { Body, Controller, Post, Res } from '@nestjs/common';
import { AiService } from './ai.service';
import { GenerateDto } from './ai.dto';
import { Response } from 'express';

@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post('generate')
  async generate(@Body() dto: GenerateDto) {
    const { prompt, system, temperature } = dto;
    return this.ai.generate(prompt, system, temperature);
  }

  // 🔥 Stream: devuelve texto plano incremental
  @Post('generate/stream')
  async generateStream(@Body() dto: GenerateDto, @Res() res: Response) {
    const { prompt, system, temperature } = dto;

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no'); // para Nginx
    res.flushHeaders?.();

    const stream = await this.ai.streamGenerate(prompt, system, temperature);

    stream.on('error', (e) => {
      console.error('Stream error:', e);
      try { res.status(500).end('Streaming error'); } catch {}
    });

    stream.pipe(res);
  }
}
