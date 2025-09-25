import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { ConvertModule } from './convert/convert.module';
import { PdfModule } from './pdf/pdf.module';

@Module({
  imports: [
    // 👇 SOLO tus módulos reales, sin TypeORM
    ConvertModule,
    PdfModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
