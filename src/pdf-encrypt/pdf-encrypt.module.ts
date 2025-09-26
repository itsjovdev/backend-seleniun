//C:\Users\jov\Documents\proyectos\seleniun\backend\api\src\pdf-encrypt\pdf-encrypt.module.ts

import { Module } from '@nestjs/common';
import { PdfEncryptController } from './pdf-encrypt.controller';
import { PdfEncryptService } from './pdf-encrypt.service';


@Module({
  controllers: [PdfEncryptController],
  providers: [PdfEncryptService],
  exports: [PdfEncryptService],
})
export class PdfEncryptModule {}