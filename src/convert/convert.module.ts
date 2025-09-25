//C:\Users\jov\Documents\proyectos\seleniun\backend\api\src\convert\convert.module.ts
import { Module } from '@nestjs/common';
import { ConvertService } from './convert.service';
import { ConversionController } from './conversion.controller';

@Module({
  controllers: [ConversionController],
  providers: [ConvertService]
})
export class ConvertModule {}