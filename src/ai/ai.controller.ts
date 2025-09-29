//C:\Users\jov\Documents\proyectos\seleniun\backend\api\src\ai\ai.controller.ts

import { Body, Controller, Post } from '@nestjs/common';
import { AiService } from './ai.service';
import { GenerateDto } from './ai.dto';

@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post('generate')
  async generate(@Body() dto: GenerateDto) {
    const { prompt, system, temperature } = dto;
    return this.ai.generate(prompt, system, temperature);
  }
}
