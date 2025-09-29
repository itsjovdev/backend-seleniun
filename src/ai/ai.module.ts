//C:\Users\jov\Documents\proyectos\seleniun\backend\api\src\ai\ai.module.ts

import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
