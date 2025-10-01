//C:\Users\jov\Documents\proyectos\seleniun\backend\api\src\ai\ai.controller.ts
//C:\Users\jov\Documents\proyectos\seleniun\backend\api\src\ai\ai.controller.ts
import { Body, Controller, Post, Res, Req } from '@nestjs/common';
import { AiService } from './ai.service';
import { GenerateDto } from './ai.dto';
import { Request, Response } from 'express';

@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post('generate')
  async generate(@Body() dto: GenerateDto) {
    const { prompt, system, temperature } = dto;
    return this.ai.generate(prompt, system, temperature);
  }

  @Post('generate/stream')
  async generateStream(
    @Body() dto: GenerateDto,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const { prompt, system, temperature } = dto;

    // Headers CORS manuales
    const origin = req.headers.origin;
    const allowedOrigins = [
      'http://localhost:8080',
      'http://127.0.0.1:8080',
      'https://seleniun.com',
      'https://www.seleniun.com',
      'https://document-intellisense.vercel.app'
    ];

    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const stream = await this.ai.streamGenerate(prompt, system, temperature);

    stream.on('error', (e) => {
      console.error('Stream error:', e);
      try { res.status(500).end('Streaming error'); } catch {}
    });

    stream.pipe(res);
  }
}