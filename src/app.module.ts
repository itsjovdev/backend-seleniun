//C:\Users\jov\Documents\proyectos\seleniun\backend\api\src\app.module.ts

import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { ConvertModule } from './convert/convert.module';
import { PdfModule } from './pdf/pdf.module';
import { PdfEncryptModule } from './pdf-encrypt/pdf-encrypt.module';

@Module({
  imports: [
    // 👇 SOLO tus módulos reales, sin TypeORM
    ConvertModule,
    PdfModule,
    PdfEncryptModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
